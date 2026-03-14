export default function Header() {
  return (
    <header className="cinema-header">
      <div className="cinema-header-inner">
        <div className="cinema-logo">CineTrack</div>

        <nav className="cinema-nav">
          <a href="/search">Search</a>
          <a href="/watched">Watched</a>
          <a href="/watchlist">Watchlist</a>
          <a href="/favorites">Favorites</a>
        </nav>
      </div>
    </header>
  );
}