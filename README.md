# 💬 React Chat System

A **real-time chat application** built with **React**, **Tailwind CSS**, **Node.js**, **Express**, and **Socket.IO**. This project enables seamless, instantaneous communication between multiple users with a modern, responsive interface.

---

## 🚀 Features

* ⚡ **Real-time messaging** powered by Socket.IO
* 📱 **Responsive UI** built with React and Tailwind CSS
* 🧩 **Robust backend** using Node.js and Express
* 🔔 **User notifications** for join/leave events
* 📈 **Scalable architecture** for future enhancements

---

## 🛠️ Tech Stack

| Category      | Technologies                      |
| ------------- | --------------------------------- |
| **Frontend**  | React, JSX, Tailwind CSS, PostCSS |
| **Backend**   | Node.js, Express                  |
| **Real-time** | Socket.IO, WebSockets             |

---

## 📁 Project Structure

```
react_chatSystem/
├── client/                 # React frontend
│   ├── public/             # Static assets
│   └── src/                # React source code
│       ├── components/     # Reusable React components
│       ├── App.jsx         # Main app component
│       └── index.js        # Entry point
├── server/                 # Node.js backend
│   ├── index.js            # Express server
│   └── socket.js           # Socket.IO logic
├── .gitignore              # Ignored files
├── package.json            # Project dependencies
└── README.md               # Project documentation
```

---

## 📦 Getting Started

### ✅ Prerequisites

* Node.js: **v16+**
* npm: **v8+**
* Git: Latest stable version

### 🔧 Installation

**1. Clone the Repository:**

```bash
git clone https://github.com/vipulsangwan771/react_chatSystem.git
cd react_chatSystem
```

**2. Install Dependencies:**

```bash
# Backend
dcd server
npm install

# Frontend
cd ../client
npm install
```

**3. Configure Environment Variables:**
Create a `.env` file in the `server/` directory:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
```

**4. Run the Application:**

```bash
# Backend
cd server
node index.js

# Frontend
cd ../client
npm start
```

📍 App will be accessible at:

* Frontend: [http://localhost:3000](http://localhost:3000)
* Backend: [http://localhost:5000](http://localhost:5000)

---

## ⚙️ How It Works

* **Socket.IO:** Establishes real-time WebSocket connections for users.
* **Messaging:** Broadcasts messages instantly to all connected clients.
* **Real-time Updates:** Seamless message delivery without page refresh.
* **Backend:** Manages user sessions, socket events, and message distribution.

---

## 🖼️ Screenshots

Modern chat interface with real-time messaging.

> 💡 *Replace `client/public/screenshot.png` with an actual screenshot or GIF.*

---

## 🌐 Deployment

### ✨ Frontend (Vercel / Netlify)

* Push the `client/` directory to a Git repository.
* Connect to **Vercel** or **Netlify**.
* **Build command:** `npm run build`
  **Output directory:** `build`

### ⚙️ Backend (Render / Heroku / Railway)

* Push the `server/` directory to a Git repository.
* Configure platform to run: `node index.js`
* Add environment variables (PORT, CLIENT\_URL) in dashboard.
* Ensure **WebSocket support** for Socket.IO.

> ✅ Update **CORS** settings in `server/index.js` to allow production frontend URL.

---

## 🧪 Testing

> 🧪 *Testing is not yet implemented.*

Consider adding:

* **Jest** for frontend
* **Mocha** for backend

```bash
cd client
npm test
```

---

## 🧯 Troubleshooting

* **CORS Errors:** Ensure `CLIENT_URL` in backend `.env` matches the frontend URL.
* **Port Conflicts:** Change `PORT` in backend `.env` if 5000 is occupied.
* **Socket.IO Issues:** Make sure your hosting supports **WebSockets**.

---

## 🔮 Future Enhancements

* 🔐 User authentication (JWT/OAuth)
* 💬 Private chats and group rooms
* 📎 File sharing (images, PDFs)
* ✍️ Typing indicators and read receipts

---

## 🤝 Contributing

We welcome contributions! 🚀

1. Fork the repository
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:

   ```bash
   git commit -m "Add your feature"
   ```
4. Push to your branch:

   ```bash
   git push origin feature/your-feature
   ```
5. Open a pull request ✅

> For major changes, please open an issue to discuss what you’d like to change.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 👨‍💻 Author

**Vipul Sangwan**
Passionate web developer from India 🇮🇳
**GitHub:** [vipulsangwan771](https://github.com/vipulsangwan771)
**Email:** [vipulsangwan771@gmail.com](mailto:vipulsangwan771@gmail.com)

---

## 🌍 Live Demo

🚧 *Coming soon!* Check back for a live demo or GIF.
