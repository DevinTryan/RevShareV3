-- Create admin user with hashed password (Devin1234)
INSERT OR IGNORE INTO users (username, email, password, role)
VALUES (
  'Devin',
  'devin@gmail.com',
  '$2b$10$YourHashedPasswordHere',  -- This will be replaced with actual hashed password
  'admin'
); 