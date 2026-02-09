# Image Certifier

Image Certifier is a digital authenticity verification platform for images and videos. It uses advanced AI (OpenAI GPT-4o) and technical analysis (EXIF, textures, noise) to identify synthetic or manipulated media.

## Features

- **Digital Authenticity Analysis**: Detect AI-generated or modified images and videos.
- **Deep Technical Scan**: Analyzes EXIF metadata, skin textures, and anatomical consistency.
- **Multi-platform Support**: Web dashboard and Expo-based mobile app (iOS/Android).
- **In-App Purchases**: Seamless premium subscription via Stripe (Web) and Apple IAP (iOS).
- **Multilingual UI**: Supports Portuguese, English, Spanish, French, German, and Chinese.

## Project Structure

- `client/`: React-based web frontend (Vite, Tailwind CSS, Shadcn/UI).
- `mobile/`: React Native (Expo) mobile application.
- `server/`: Express.js backend with Drizzle ORM and PostgreSQL.
- `shared/`: Shared schema definitions and types.

## Prerequisites

- Node.js (v20+ recommended)
- PostgreSQL database
- OpenAI API Key
- Stripe API Keys (optional, for web payments)

## Getting Started

### Backend & Web

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (`.env`):
   ```
   DATABASE_URL=your_postgresql_url
   OPENAI_API_KEY=your_openai_key
   STRIPE_SECRET_KEY=your_stripe_key
   ```

3. Initialize the database:
   ```bash
   npm run db:push
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Mobile

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Expo:
   ```bash
   npx expo start
   ```

## Deployment

### Web
The project is optimized for deployment on Replit or typical VPS environments using `npm run build` and `npm start`.

### Mobile
Use EAS (Expo Application Services) for builds:
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Apple App Store Compliance

This project includes specific updates for Guideline 1.1 (Safety), 3.1.1 (Payments), and 2.1 (Privacy):
- Neutral terminology for "Digital Authenticity".
- Integrated Apple In-App Purchase verification (`/api/apple/verify-receipt`).
- Mandatory Face Data disclosures in the Privacy Policy.

## License

MIT
