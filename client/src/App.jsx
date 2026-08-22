import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import AddMemory from "./pages/AddMemory";
import Search from "./pages/Search";

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("mistake-memo-theme") || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("mistake-memo-theme", theme); }, [theme]);
  return (
    <BrowserRouter>
      <Navbar theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add" element={<AddMemory />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
