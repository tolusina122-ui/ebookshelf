import { ThemeToggle } from "./theme-toggle";
import ShoppingCart from "./shopping-cart";
import { useLocation } from "wouter";

export function Navbar() {
  const [, setLocation] = useLocation();

  const handleLogoClick = () => {
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <button 
          onClick={handleLogoClick} 
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 bg-transparent border-0 p-0"
        >
          <span className="text-xl font-bold">BookStore</span>
        </button>

        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <ShoppingCart />
        </div>
      </div>
    </header>
  );
}