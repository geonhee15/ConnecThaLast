// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyADKvh6Xp5wHNRLiL1f-nfnrSxqAwgfNM0",
  authDomain: "connecthalast.firebaseapp.com",
  databaseURL: "https://connecthalast-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "connecthalast",
  storageBucket: "connecthalast.firebasestorage.app",
  messagingSenderId: "294363153131",
  appId: "1:294363153131:web:6da2aed45d999ad9d8b4ae",
  measurementId: "G-1R3Z15HBKG"
};

// Firebase 초기화
let firebaseApp = null;
let db = null;

try {
  firebaseApp = firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  console.log('Firebase initialized');
} catch (e) {
  console.warn('Firebase not configured:', e.message);
}
