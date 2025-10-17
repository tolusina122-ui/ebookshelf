import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import type { Book } from "@shared/schema";

interface BookCardProps {
  book: Book;
  onAddToCart: (book: Book) => void;
}

export function BookCard({ book, onAddToCart }: BookCardProps) {
  return (
    <Card 
      className="overflow-hidden hover-elevate transition-all duration-300" 
      data-testid={`card-book-${book.id}`}
    >
      <div className="aspect-[2/3] overflow-hidden bg-muted">
        <img
          src={book.coverImage}
          alt={book.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <h3 
            className="font-semibold text-lg line-clamp-2 leading-snug" 
            data-testid={`text-book-title-${book.id}`}
          >
            {book.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {book.description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span 
            className="text-2xl font-bold text-primary" 
            data-testid={`text-price-${book.id}`}
          >
            ${parseFloat(book.price).toFixed(2)}
          </span>
          <Button 
            onClick={() => onAddToCart(book)}
            data-testid={`button-add-to-cart-${book.id}`}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}
