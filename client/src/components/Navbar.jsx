import { NavLink } from "react-router-dom";
import { Brain, Moon, PlusCircle, Search, Sun } from "lucide-react";

export default function Navbar({ theme, onToggleTheme }) {
  return (
    <nav>
      <div className="nav-wrap" style={{ maxWidth: 1080, margin: "0 auto" }}>
        <NavLink to="/" end className="nav-brand" aria-label="MistakeMemo dashboard">
          <Brain size={20} /> <span>MistakeMemo</span>
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
          Dashboard
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => isActive ? "active" : ""}>
          <PlusCircle size={17} /> Add Mistake
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => isActive ? "active" : ""}>
          <Search size={17} /> Search
        </NavLink>
        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
      </div>
    </nav>
  );
}
