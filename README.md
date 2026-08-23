<div align="center">
  <img src="sheild-frontend/public/sheild-pwa-512.png" alt="SHEild Logo" width="150"/>
  <h1>SHEild</h1>
  <p><b>Advanced Agentic Personal Safety & PWA Protection Platform</b></p>
</div>

<br />

SHEild is a comprehensive, modern Progressive Web Application (PWA) dedicated to women's personal safety. Built using a reactive React/TypeScript frontend and a robust Spring Boot Java backend, it leverages real-time Firebase Cloud Messaging and Geolocation logic to seamlessly bridge the gap between emergency distress and immediate help.

---

## 🚀 Key Features & Implementation Logic

### 1. 🆘 SOS Emergency Alerts
**What it does:** Instantly alerts trusted contacts when the user is in danger.  
**Logic & Implementation:**
- A large, easily accessible panic button exists on the main dashboard.  
- When triggered, the frontend (`SOSStore.tsx`) calls the backend `EmergencySession` API, marking the start of a distress event.
- The Java backend (`EmergencyController.java`) subsequently delegates to the Firebase Admin SDK (`FcmService.java`) which iterates over the user's Guard Circle contacts and shoots out real-time High-Priority FCM Push Notifications.

### 2. 🛡️ Guard Circle
**What it does:** Allows users to build a multi-tier trusted group of contacts who receive SOS alerts and location updates.  
**Logic & Implementation:**
- Users can manage their contacts via the UI, saving names and phone numbers to their core `UserProfile`.
- The `GuardCircleController.java` manages persistence of these `GuardCircleDetail` objects within the backend database.
- It is heavily integrated with the SOS signaling loop, acting as the primary audience for emergency distress push notifications.

### 3. 🗺️ Location Tracking & Safe Zones (Geofencing)
**What it does:** Monitors user location and defines comfortable geofenced boundaries (like Home, Campus, or Workplace).  
**Logic & Implementation:**
- Uses a `LeafletMapComponent` via `react-leaflet` to display real-time spatial positioning to the user securely.
- Built using the `navigator.geolocation` API in the browser. 
- Users plot interactive radius polygons. This data passes cleanly through the API to `SafeZoneController.java`, persisting coordinates and radius radii as distinct `SafeZoneType` entities. If continuous background location was permitted, entering/exiting these zones could logically emit alerts.

### 4. 📞 Quick Dial & Fake Call Simulator
**What it does:** Immediate one-tap access to authorities (Police, Ambulance) or the ability to trigger a simulated incoming call to exit uncomfortable social situations.  
**Logic & Implementation:**
- The frontend houses a `QuickDialModal` which surfaces hyperlinked `tel:` anchors based on local emergency configurations.
- Handled internally via React State without needing a backend roundtrip for maximum speed, though personal dial configurations can be stored backend via `QuickDial.java` models.

### 5. 📱 Installable PWA Experience
**What it does:** SHEild functions just like a native OS application, living on the user's home screen with offline capabilities.  
**Logic & Implementation:**
- Delivered via a tightly tuned `manifest.webmanifest`.
- Intercepts requests using Service Workers (`sw.js` and `firebase-messaging-sw.js`), caching the static Shell with Workbox so the app immediately boots up even under spotty cell reception.

---

## 🛠️ Architecture & Tech Stack

### Frontend (User Interface)
- **Framework Development**: React + Vite + TypeScript.
- **Styling**: Tailwind CSS & extensive native CSS animations for high-velocity rescue interfaces.
- **State Management**: Zustand-style lightweight stores (`authStore.ts`, `sosStore.ts`, `pwaStore.ts`).
- **Mapping**: Leaflet JS (`react-leaflet`).

### Backend (API Server)
- **Core Engine**: Java 17+ running Spring Boot 3.
- **Authorization**: JSON Web Tokens mapping securely to `FirebaseAuthFilter.java` to prevent unauthorized execution.
- **Communications**: Firebase Cloud Messaging (FCM) utilizing the Firebase Admin Java SDK.

### Database & Deployment Infrastructure
- **Data Persistence**: Backed via Cloud Database integrations (mapped to structured Java POJOs).
- **CORS Handling**: Deeply locked-down `CorsConfig.java` natively whitelisting only production clients.

---

## 🛑 Security & Privacy Setup
*Note: Due to our zero-trust safety guarantee, absolutely no API secrets, database passwords, or Google Cloud Run YAMLs are persisted in this repository. All deployers must supply their own Firebase properties within `application.yml.example`.*
