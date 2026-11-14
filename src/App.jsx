import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Browse from './pages/Browse.jsx';
import Listing from './pages/Listing.jsx';
import Host from './pages/Host.jsx';

export default function App() {
  // The search lives here so it survives moving between the list and a listing.
  const [search, setSearch] = useState({ group: 'any', people: 1, stepFree: false, pets: false });
  const [coords, setCoords] = useState(null);

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">BHaven</div>
        <nav className="topnav" aria-label="Main">
          <NavLink to="/" end>
            Find a place
          </NavLink>
          <NavLink to="/host">Host console</NavLink>
        </nav>
        <div className="spacer" />
        <div className="demo-chip">Demo data: bed counts and policies are placeholders</div>
      </header>

      <Routes>
        <Route
          path="/"
          element={<Browse search={search} setSearch={setSearch} coords={coords} setCoords={setCoords} />}
        />
        <Route path="/place/:id" element={<Listing search={search} setSearch={setSearch} />} />
        <Route path="/host" element={<Host />} />
      </Routes>

      <footer className="footnote">
        Hackathon demo with sample data. Not affiliated with or endorsed by the organizations shown. In an
        emergency call 911.
      </footer>
    </div>
  );
}
