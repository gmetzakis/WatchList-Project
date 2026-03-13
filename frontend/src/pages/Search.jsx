import { useState } from "react";
import api from "../api/axios";
import { useAuthStore } from "../store/authStore";
import { Link } from "react-router-dom";

export default function Search() {
  console.log("Rendered");
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [debug, setDebug] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    setDebug("Submitting form...");

    if (!query.trim()) {
      setDebug("Empty query");
      return;
    }

    try {
      const res = await api.get(`/tmdb/search?query=${query}`);
      setResults(res.data.results);
      setDebug(`Success: ${res.data.results.length} results`);
    } catch (err) {
      setDebug("Error: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <p className="mb-4">Welcome, {user?.email}</p>

      <form
        onSubmit={handleSearch}
        className="flex gap-2 mb-6 border border-red-500 p-4"
      >
        <input
          type="text"
          placeholder="Search movies or series..."
          className="flex-1 p-3 rounded bg-neutral-900"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            console.log("TYPING:", e.target.value);
          }}
        />

        <button
          type="submit"
          className="bg-blue-600 px-4 py-2 rounded pointer-events-auto"
          onClick={() => console.log("BUTTON CLICKED")}
        >
          Search
        </button>
      </form>

      <p className="mb-4">{debug}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {results.map((item) => (
          <Link
            key={item.id}
            to={`/media/${item.id}`}
            className="block hover:opacity-80 transition"
          >
            <img
              src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
              alt={item.title || item.name}
              className="rounded"
            />
            <p className="mt-2 text-sm text-center">
              {item.title || item.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
