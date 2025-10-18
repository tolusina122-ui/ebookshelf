import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";

export function ShoppingCartSheet() {
  const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems } = useCartStore();
  const [, setLocation] = useLocation();
  const totalItems = getTotalItems();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative" 
          data-testid="button-cart"
        >
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-cart-count"
            >
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Shopping Cart ({totalItems} items)</SheetTitle>
          <SheetDescription>
            Review your items and proceed to checkout
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col h-full mt-6">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Your cart is empty</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto space-y-4">
                {items.map((item) => (
                  <div 
                    key={item.book.id} 
                    className="flex gap-4" 
                    data-testid={`cart-item-${item.book.id}`}
                  >
                    <img
                      src={item.book.coverImage}
                      alt={item.book.title}
                      className="w-20 h-28 object-cover rounded-md bg-muted"
                    />
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-semibold line-clamp-2">{item.book.title}</h4>
                        <p className="text-sm font-semibold text-primary">
                          ${parseFloat(item.book.price).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 border rounded-md">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.book.id, item.quantity - 1)}
                            data-testid={`button-decrease-${item.book.id}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span 
                            className="w-8 text-center text-sm font-medium"
                            data-testid={`text-quantity-${item.book.id}`}
                          >
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.book.id, item.quantity + 1)}
                            data-testid={`button-increase-${item.book.id}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeItem(item.book.id)}
                          data-testid={`button-remove-${item.book.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span data-testid="text-cart-total">
                    ${getTotalPrice().toFixed(2)}
                  </span>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => setLocation("/checkout")}
                  data-testid="button-checkout"
                >
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}