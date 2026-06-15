package monitor

import (
	"context"
	"io"
	"log"
	"os"
	"time"
)

// LogLine represents a read log line with its source path.
type LogLine struct {
	Path      string
	Content   string
	Timestamp time.Time
}

// TailFile reads a file line by line as it is written.
// It handles log rotations (rename-recreate, copytruncate) robustly.
func TailFile(ctx context.Context, filePath string, linesChan chan<- LogLine) {
	var file *os.File
	var err error

	openAndSeek := func() bool {
		file, err = os.Open(filePath)
		if err != nil {
			log.Printf("[Warning] Failed to open file %s: %v. Retrying...", filePath, err)
			return false
		}
		// Seek to the end of the file on startup to avoid reading massive histories
		_, err = file.Seek(0, io.SeekEnd)
		if err != nil {
			log.Printf("[Error] Failed to seek file %s: %v", filePath, err)
			file.Close()
			return false
		}
		return true
	}

	// Retry loop for initial opening
	for {
		select {
		case <-ctx.Done():
			return
		default:
			if openAndSeek() {
				break
			}
			time.Sleep(2 * time.Second)
			continue
		}
		break
	}

	defer func() {
		if file != nil {
			file.Close()
		}
	}()

	buffer := make([]byte, 4096)
	var partialLine []byte
	var offset int64

	// Get initial offset
	offset, err = file.Seek(0, io.SeekCurrent)
	if err != nil {
		log.Printf("[Error] Cannot get offset for %s: %v", filePath, err)
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
			// Read from the current position
			n, err := file.Read(buffer)
			if n > 0 {
				offset += int64(n)
				for i := 0; i < n; i++ {
					if buffer[i] == '\n' {
						// Strip trailing carriage return if any (for Windows compatibility)
						lineText := string(partialLine)
						if len(lineText) > 0 && lineText[len(lineText)-1] == '\r' {
							lineText = lineText[:len(lineText)-1]
						}

						linesChan <- LogLine{
							Path:      filePath,
							Content:   lineText,
							Timestamp: time.Now(),
						}
						partialLine = nil
					} else {
						partialLine = append(partialLine, buffer[i])
					}
				}
			}

			if err == io.EOF {
				// We reached the end of the file. Sleep briefly and check for rotation.
				time.Sleep(200 * time.Millisecond)

				// 1. Get stats of the open file descriptor
				openInfo, openErr := file.Stat()
				if openErr != nil {
					log.Printf("[Error] Failed to stat open file descriptor for %s: %v", filePath, openErr)
					continue
				}

				// 2. Get stats of the file path on disk
				diskInfo, diskErr := os.Stat(filePath)
				if diskErr != nil {
					// File might have been renamed and new file not created yet, or deleted
					// Sleep and wait for it to be recreated
					time.Sleep(1 * time.Second)
					continue
				}

				// 3. Check for copytruncate (file size decreased)
				if diskInfo.Size() < openInfo.Size() {
					log.Printf("[Info] Log file %s was truncated. Reopening...", filePath)
					file.Close()
					partialLine = nil

					// Reopen and seek to start
					for {
						file, err = os.Open(filePath)
						if err == nil {
							offset = 0
							break
						}
						time.Sleep(1 * time.Second)
					}
					continue
				}

				// 4. Check for rename-recreate rotation (inode or identity changed)
				if !os.SameFile(openInfo, diskInfo) {
					log.Printf("[Info] Log file %s was rotated. Reopening new log...", filePath)
					// Drain any remaining partial lines
					if len(partialLine) > 0 {
						linesChan <- LogLine{
							Path:      filePath,
							Content:   string(partialLine),
							Timestamp: time.Now(),
						}
						partialLine = nil
					}

					file.Close()

					// Reopen and seek to start (since it is a fresh file)
					for {
						file, err = os.Open(filePath)
						if err == nil {
							offset = 0
							break
						}
						time.Sleep(1 * time.Second)
					}
					continue
				}
			} else if err != nil && err != io.EOF {
				log.Printf("[Error] Error reading %s: %v. Reopening...", filePath, err)
				file.Close()
				time.Sleep(1 * time.Second)
				openAndSeek()
			}
		}
	}
}