// src/components/Users.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase"; // ⚠️ fix path if needed
import { collection, onSnapshot } from "firebase/firestore";

function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(data);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h2>Users List</h2>
      {users.map((user) => (
        <p key={user.id}>{user.name}</p>
      ))}
    </div>
  );
}

export default Users;