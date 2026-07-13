# Image Quilting and Texture Transfer

A full-stack image processing web application for generating quilted textures and texture-transfer outputs from uploaded images. The project combines a Node.js/Express backend, MongoDB-backed authentication/history, and Python computer vision scripts for the image generation pipeline.

## Features

- User registration and login with JWT-based authentication.
- Image quilting preview generation from uploaded source textures.
- Save and view generated quilting outputs in a user profile.
- Texture transfer workflow using texture and target images.
- ArtBot route support for AI-assisted creative prompts.
- Static frontend pages for dashboard, login, registration, quilting, and texture transfer.

## Tech Stack

- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **Authentication:** JWT, bcryptjs
- **File Uploads:** Multer
- **Image Processing:** Python, OpenCV, NumPy, Pillow
- **Frontend:** HTML, CSS, JavaScript

## Repository Hygiene

This repository intentionally excludes generated/runtime folders such as:

- `node_modules/`
- `.env`
- `uploads/`
- `temp_outputs/`
- `outputs/`

Install dependencies locally instead of committing generated dependency folders.

## Prerequisites

- Node.js 18 or newer
- Python 3.9 or newer
- MongoDB connection string
- Optional: Hugging Face API key for ArtBot features

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=5001
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
JWT_SECRET=replace-with-a-long-random-secret
HUGGING_FACE_API_KEY=optional-api-key
```

An example template is available in `.env.example`.

## Installation

```bash
git clone https://github.com/Reddy4599/Image-Quilting-and-Texture-Transfer.git
cd Image-Quilting-and-Texture-Transfer
npm install
pip install -r requirements.txt
cp .env.example .env
```

Update `.env` with your actual MongoDB URI and secret values.

## Run Locally

```bash
npm start
```

Open `http://localhost:5001` in your browser.

## API Overview

- `GET /api/health` - server and database health check
- `POST /api/auth/register` - create a user account
- `POST /api/auth/login` - authenticate and receive a JWT
- `POST /api/quilting/preview` - generate a quilting preview
- `POST /api/quilting/save` - save a preview to user history
- `POST /api/texture-transfer` - generate texture transfer output
- `GET /api/user/profile` - fetch authenticated user history

## Project Structure

```text
models/       Mongoose schemas
public/       Static frontend pages, CSS, JS, and generated public images
routes/       Express route modules
scripts/      Python image-processing scripts
utils/        Supporting API utilities
server.js     Express application entry point
```

## Notes

- The app exits at startup if required environment variables are missing.
- Generated images are runtime artifacts and should not be committed unless they are intentional examples.
- Python scripts currently call `python3`; on Windows, use a Python launcher or adjust the command if needed.

## Author

**Medagam V S Manjunadha Reddy**  
[GitHub](https://github.com/Reddy4599)
