# Document Management System Backend

A robust backend API for a document management system built with Node.js, Express, and MongoDB.

## Features

- User authentication and authorization
- Document upload and management
- File sharing capabilities
- Audit logging
- Secure file storage
- RESTful API endpoints

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn package manager

## Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

## Project Structure

```
backend/
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── utils/          # Utility functions
├── uploads/        # File upload directory
├── app.js          # Express application setup
└── index.js        # Server entry point
```

## Available Scripts

- `npm start`: Start the development server with nodemon

## API Endpoints

### Authentication

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user

### Documents

- `POST /api/documents/upload` - Upload a new document
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get a specific document
- `GET /api/documents/:id/download` - Download a document
- `PUT /api/documents/:id` - Update a document
- `DELETE /api/documents/:id` - Delete a document
- `POST /api/documents/:id/share` - Share a document

### Audit Logs

- `GET /api/audit-logs` - Get audit logs

## Dependencies

- express: Web framework
- mongoose: MongoDB object modeling
- bcrypt: Password hashing
- jsonwebtoken: JWT authentication
- multer: File upload handling
- cors: Cross-origin resource sharing
- dotenv: Environment variable management
- nodemon: Development server with auto-reload

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- CORS enabled
- Secure file upload handling
- Environment variable protection

## Error Handling

The API includes comprehensive error handling middleware that provides:

- Detailed error messages in development
- Sanitized error responses in production
- Proper HTTP status codes
- Consistent error response format

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the ISC License.
