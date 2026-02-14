-- Seed default admin user (password: admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$dUZFGjBER6254DPrOJKR8exUvlb8FdG9y2UY6n7GyF9xFwa90VufS', 'admin')
ON CONFLICT (username) DO NOTHING;
