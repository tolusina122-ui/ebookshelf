import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TransactionWithOrder {
  id: string;
  amount: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    customerEmail: string;
    status: string;
  };
}

export default function AdminTransactions() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: transactions } = useQuery<TransactionWithOrder[]>({
    queryKey: ["/api/admin/transactions"],
  });

  const refundMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await apiRequest("POST", `/api/admin/transactions/${transactionId}/refund`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet"] });
      toast({ title: "Refund processed successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Refund failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTransactions = transactions?.filter((t) =>
    t.order.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      refunded: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>
        {status}
      </Badge>
    );
  };

  const getPaymentMethodDisplay = (method: string) => {
    const displays: Record<string, string> = {
      mastercard: "Mastercard",
      visa: "Visa",
      prepaid: "Prepaid Card",
      google_pay: "Google Pay",
      apple_pay: "Apple Pay",
    };
    return displays[method] || method;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">View and manage all payment transactions</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or transaction ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-transactions"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions && filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                    <TableCell className="font-mono text-sm">
                      {transaction.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{transaction.order.customerEmail}</TableCell>
                    <TableCell className="font-semibold">
                      ${parseFloat(transaction.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>{getPaymentMethodDisplay(transaction.paymentMethod)}</TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell>
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {transaction.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refundMutation.mutate(transaction.id)}
                          disabled={refundMutation.isPending}
                          data-testid={`button-refund-${transaction.id}`}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
