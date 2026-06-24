package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/ozyshield/ozyshield-server/internal/config"
)

// User represents a dashboard user with role and team assignment.
type User struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"password,omitempty"`
	Role     string   `json:"role"`
	TeamID   string   `json:"team_id"`
	Teams    []string `json:"teams"`
	Avatar   string   `json:"avatar"`
}

// UserResponse is the safe representation (no password) sent to clients.
type UserResponse struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Role     string   `json:"role"`
	TeamID   string   `json:"team_id"`
	Teams    []string `json:"teams"`
	Avatar   string   `json:"avatar"`
}

func toResponse(u User) UserResponse {
	return UserResponse{
		ID: u.ID, Name: u.Name, Email: u.Email,
		Role: u.Role, TeamID: u.TeamID, Teams: u.Teams, Avatar: u.Avatar,
	}
}

func toResponseList(users []User) []UserResponse {
	out := make([]UserResponse, len(users))
	for i, u := range users {
		out[i] = toResponse(u)
	}
	return out
}

// Invitation represents a pending team invitation.
type Invitation struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	TeamID   string `json:"team_id"`
	TeamName string `json:"team_name"`
	InvitedBy string `json:"invited_by"`
	Status   string `json:"status"` // "pending", "accepted", "declined"
	CreatedAt string `json:"created_at"`
}

// UserStore is an in-memory thread-safe store for users.
type UserStore struct {
	mu          sync.RWMutex
	users       map[string]User
	invitations []Invitation
	currentUser string // ID of logged-in user
}

// NewUserStore initializes a UserStore with admin from config.
func NewUserStore(cfg *config.Config) *UserStore {
	us := &UserStore{
		users:       make(map[string]User),
		invitations: make([]Invitation, 0),
		currentUser: "admin-001",
	}
	if cfg != nil && cfg.AdminEmail != "" {
		us.users["admin-001"] = User{
			ID:       "admin-001",
			Name:     "Admin",
			Email:    cfg.AdminEmail,
			Password: cfg.AdminPassword,
			Role:     "admin",
			Teams:    []string{},
		}
	}
	return us
}

func (us *UserStore) list() []User {
	us.mu.RLock()
	defer us.mu.RUnlock()
	list := make([]User, 0, len(us.users))
	for _, u := range us.users {
		list = append(list, u)
	}
	return list
}

func (us *UserStore) get(id string) (User, bool) {
	us.mu.RLock()
	defer us.mu.RUnlock()
	u, ok := us.users[id]
	return u, ok
}

func (us *UserStore) getByEmail(email string) (User, bool) {
	us.mu.RLock()
	defer us.mu.RUnlock()
	for _, u := range us.users {
		if u.Email == email {
			return u, true
		}
	}
	return User{}, false
}

func (us *UserStore) create(u User) User {
	us.mu.Lock()
	defer us.mu.Unlock()
	us.users[u.ID] = u
	return u
}

func (us *UserStore) update(id string, u User) (User, bool) {
	us.mu.Lock()
	defer us.mu.Unlock()
	existing, ok := us.users[id]
	if !ok {
		return User{}, false
	}
	if u.Name != "" {
		existing.Name = u.Name
	}
	if u.Email != "" {
		existing.Email = u.Email
	}
	if u.Role != "" {
		existing.Role = u.Role
	}
	if u.Teams != nil {
		existing.Teams = u.Teams
	}
	if u.Avatar != "" {
		existing.Avatar = u.Avatar
	}
	if u.Password != "" {
		existing.Password = u.Password
	}
	existing.ID = id
	us.users[id] = existing
	return existing, true
}

func (us *UserStore) delete(id string) bool {
	us.mu.Lock()
	defer us.mu.Unlock()
	if id == "admin-001" {
		return false // cannot delete admin
	}
	if _, ok := us.users[id]; !ok {
		return false
	}
	delete(us.users, id)
	return true
}

func (us *UserStore) getCurrentUser() User {
	us.mu.RLock()
	defer us.mu.RUnlock()
	u, ok := us.users[us.currentUser]
	if !ok {
		return User{ID: "admin-001", Name: "Admin", Role: "admin"}
	}
	return u
}

func (us *UserStore) setCurrentUser(id string) {
	us.mu.Lock()
	defer us.mu.Unlock()
	us.currentUser = id
}

// Invitation methods

func (us *UserStore) listInvitations() []Invitation {
	us.mu.RLock()
	defer us.mu.RUnlock()
	return us.invitations
}

func (us *UserStore) createInvitation(inv Invitation) Invitation {
	us.mu.Lock()
	defer us.mu.Unlock()
	us.invitations = append(us.invitations, inv)
	return inv
}

func (us *UserStore) updateInvitation(id string, status string) (Invitation, bool) {
	us.mu.Lock()
	defer us.mu.Unlock()
	for i, inv := range us.invitations {
		if inv.ID == id {
			us.invitations[i].Status = status
			return us.invitations[i], true
		}
	}
	return Invitation{}, false
}

// ServerAPI extensions for Users

// ListUsers returns all users (without passwords).
func (api *ServerAPI) ListUsers(w http.ResponseWriter, r *http.Request) {
	users := api.users.list()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toResponseList(users))
}

// GetCurrentUser returns the current logged-in user (without password).
func (api *ServerAPI) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := api.users.getCurrentUser()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toResponse(user))
}

// SwitchUser switches the current user (for demo purposes).
func (api *ServerAPI) SwitchUser(w http.ResponseWriter, r *http.Request) {
	type Payload struct {
		UserID string `json:"user_id"`
	}
	var p Payload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	api.users.setCurrentUser(p.UserID)
	user := api.users.getCurrentUser()
	log.Printf("[Server] Switched to user: %s (%s)", user.Name, user.Role)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toResponse(user))
}

// CreateUser adds a new user.
func (api *ServerAPI) CreateUser(w http.ResponseWriter, r *http.Request) {
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if u.Name == "" || u.Email == "" {
		http.Error(w, "Missing name or email", http.StatusBadRequest)
		return
	}
	if u.ID == "" {
		u.ID = "user_" + strings.ToLower(strings.ReplaceAll(u.Name, " ", "_"))
	}
	if u.Role == "" {
		u.Role = api.Cfg.DefaultRole
	}
	if _, exists := api.users.getByEmail(u.Email); exists {
		http.Error(w, "Email already exists", http.StatusConflict)
		return
	}
	created := api.users.create(u)
	log.Printf("[Server] User created: %s (%s)", created.Name, created.Role)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(toResponse(created))
}

// Login authenticates a user with email and password.
func (api *ServerAPI) Login(w http.ResponseWriter, r *http.Request) {
	type LoginPayload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	var p LoginPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if p.Email == "" || p.Password == "" {
		http.Error(w, "Missing email or password", http.StatusBadRequest)
		return
	}
	user, found := api.users.getByEmail(p.Email)
	if !found {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}
	if user.Password != p.Password {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}
	api.users.setCurrentUser(user.ID)
	log.Printf("[Server] User logged in: %s (%s)", user.Name, user.Role)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user":    toResponse(user),
		"token":   api.Cfg.AuthToken,
		"message": "Login successful",
	})
}

// ValidateToken checks if a token is valid and returns the current user.
func (api *ServerAPI) ValidateToken(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")
	if token != api.Cfg.AuthToken {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}
	user := api.users.getCurrentUser()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": true,
		"user":  toResponse(user),
	})
}

// GetConfig returns public configuration (no secrets).
func (api *ServerAPI) GetConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"registration_enabled": api.Cfg.EnableRegister,
		"default_role":         api.Cfg.DefaultRole,
	})
}

// UpdateUser updates an existing user.
func (api *ServerAPI) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	updated, ok := api.users.update(userID, u)
	if !ok {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	log.Printf("[Server] User updated: %s", updated.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toResponse(updated))
}

// DeleteUser removes a user.
func (api *ServerAPI) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	if !api.users.delete(userID) {
		http.Error(w, "Cannot delete user", http.StatusForbidden)
		return
	}
	log.Printf("[Server] User deleted: %s", userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// ListInvitations returns all invitations.
func (api *ServerAPI) ListInvitations(w http.ResponseWriter, r *http.Request) {
	invitations := api.users.listInvitations()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invitations)
}

// CreateInvitation sends a team invitation.
func (api *ServerAPI) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	var inv Invitation
	if err := json.NewDecoder(r.Body).Decode(&inv); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if inv.Email == "" || inv.TeamID == "" {
		http.Error(w, "Missing email or team_id", http.StatusBadRequest)
		return
	}
	if inv.ID == "" {
		inv.ID = "inv_" + strings.ReplaceAll(inv.Email, "@", "_at_")
	}
	inv.Status = "pending"
	if inv.CreatedAt == "" {
		inv.CreatedAt = time.Now().Format(time.RFC3339)
	}
	created := api.users.createInvitation(inv)
	log.Printf("[Server] Invitation sent to %s for team %s", inv.Email, inv.TeamName)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// RespondInvitation accepts or declines an invitation.
func (api *ServerAPI) RespondInvitation(w http.ResponseWriter, r *http.Request) {
	invID := r.PathValue("id")
	type Payload struct {
		Status string `json:"status"` // "accepted" or "declined"
	}
	var p Payload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if p.Status != "accepted" && p.Status != "declined" {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}
	updated, ok := api.users.updateInvitation(invID, p.Status)
	if !ok {
		http.Error(w, "Invitation not found", http.StatusNotFound)
		return
	}
	log.Printf("[Server] Invitation %s %s", invID, p.Status)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}
