 # Hostinger Deployment Guide

This guide details how to deploy your application to Hostinger Business Hosting (Node.js).

## 1. Prerequisites
- **Hostinger Business Hosting** or **VPS** plan.
- **GitHub Repository**: [https://github.com/aarsayem33-coder/uhud-final.git](https://github.com/aarsayem33-coder/uhud-final.git)

## 2. Hostinger Setup (hPanel)

1.  **Login to Hostinger hPanel**.
2.  Navigate to **Websites** and manage your site (`www.uhudbuilders.com`).
3.  Search for **Node.js** in the sidebar. NOT "Files" or "Databases".
4.  **Create a New Application**:
    -   **Node.js Version**: Select **v18** or **v20** (Recommended).
    -   **Application Mode**: **Production**.
    -   **Application Root**: `public_html/` (or a subdirectory).
    -   **Application Startup File**: `src/server.ts`
        *Note: If Hostinger requires a `.js` file and fails with `.ts`, change the Startup Command to `npm start`.*
    -   **Click Create**.

## 3. Uploading Files

### Option A: Via Git (Recommended)
1.  In the Node.js settings, look for **Git Repository** section.
2.  Enter your repo URL: `https://github.com/aarsayem33-coder/uhud-final.git`.
3.  Branch: `main`.
4.  Click **Install** or **Deploy**.

### Option B: Manual Upload
1.  Go to **File Manager**.
2.  Upload the contents of your project to `public_html`.

## 4. Install Dependencies & Build

1.  In the Node.js Dashboard, click **NPM Install**. This installs dependencies from `package.json`.
2.  **Build the Frontend**:
    -   Hostinger's UI might not have a "Build" button. You usually need to run the build command via SSH or "Run NPM Command" feature.
    -   **Command**: `npm run build`
    -   This will create a `dist` folder which the server serves.

## 5. Environment & Secrets (CRITICAL)

You must verify these files exist on the server as they are **not** in GitHub for security:

1.  **Service Account Key**:
    -   Upload `serviceAccountKey.json` to the **root** of your application folder (same level as `src`).
2.  **.env File**:
    -   Create a `.env` file in the root or set these variables in the **Environment Variables** section of the dashboard.
    -   Ensure `PORT` is set (Hostinger usually handles this, but your code calls `process.env.PORT`).

## 6. Start the Server

1.  In the Node.js Dashboard, ensure the **App Status** is **Running**.
2.  If it fails, check **Startup Command**. It should execute `npm start`.
3.  Click **Restart**.

## 7. Troubleshooting

-   **Logs**: Check `server_error.log` in the root folder using File Manager if the site doesn't load.
-   **Dependencies**: Ensure `framework` like `vite` or `tsx` are installed. Using `npm install` handles this.
