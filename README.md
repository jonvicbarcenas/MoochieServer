# Image Upload Server

A simple Node.js server for uploading and displaying images with a 4-digit code identifier.

## Features

- Upload images with a 4-digit code
- Upload images without a code (auto-generates a random 4-digit code)
- If an image with the same code is uploaded, it replaces the existing one
- View all uploaded images
- Search for images by their code
- JSON API with the format:
  ```
  {
    "code": "1234",
    "imageUrl": "/uploads/image-1234.jpg"
  }
  ```

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```

## API Endpoints

### Upload an image with code
- **URL**: `/api/upload`
- **Method**: `POST`
- **Form Data**:
  - `code`: 4-digit number
  - `image`: Image file
- **Response**: JSON object with `code` and `imageUrl`

### Upload an image without code
- **URL**: `/api/upload/auto`
- **Method**: `POST`
- **Form Data**:
  - `image`: Image file
- **Response**: JSON object with auto-generated `code` and `imageUrl`

### Get all images
- **URL**: `/api/images`
- **Method**: `GET`
- **Response**: Array of JSON objects with `code` and `imageUrl`

### Get image by code
- **URL**: `/api/images/:code`
- **Method**: `GET`
- **URL Parameters**: `code` (4-digit number)
- **Response**: JSON object with `code` and `imageUrl`

## Web Interface

Open your browser and navigate to `http://localhost:3000` to use the web interface for uploading and viewing images.

## License

ISC 