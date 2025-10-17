import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, ArrowDownToLine, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WalletTransaction } from "@shared/schema";

interface WalletData {
  availableBalance: number;
  pendingBalance: number;
  transactions: WalletTransaction[];
}

const transferSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  bankAccountInfo: z.string().min(1, "Bank account info is required"),
});

type TransferForm = z.infer<typeof transferSchema>;

export default function AdminWallet() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: walletData } = useQuery<WalletData>({
    queryKey: ["/api/admin/wallet"],
  });

  const form = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      amount: "",
      bankAccountInfo: "",
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: TransferForm) => {
      const response = await apiRequest("POST", "/api/admin/wallet/transfer", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet"] });
      toast({ title: "Transfer initiated successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransferForm) => {
    transferMutation.mutate(data);
  };

  const getTransactionTypeDisplay = (type: string) => {
    const displays: Record<string, string> = {
      payment_received: "Payment Received",
      transfer_to_bank: "Transfer to Bank",
      refund_issued: "Refund Issued",
    };
    return displays[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">Manage your earnings and transfers</p>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-available-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-available-balance">
              ${walletData?.availableBalance.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-pending-balance">
              ${walletData?.pendingBalance.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Processing payments</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button data-testid="button-transfer-funds">
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Transfer to Bank Account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Funds</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-transfer-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bankAccountInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Account Info</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Account number or details"
                        {...field}
                        data-testid="input-bank-account"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" data-testid="button-submit-transfer">
                Transfer Funds
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {walletData?.transactions && walletData.transactions.length > 0 ? (
            <div className="space-y-3">
              {walletData.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                  data-testid={`wallet-transaction-${transaction.id}`}
                >
                  <div>
                    <p className="font-medium">{getTransactionTypeDisplay(transaction.type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </p>
                    {transaction.description && (
                      <p className="text-sm text-muted-foreground">{transaction.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold ${
                        transaction.type === "payment_received"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "payment_received" ? "+" : "-"}$
                      {parseFloat(transaction.amount).toFixed(2)}
                    </span>
                    {getStatusBadge(transaction.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No transactions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
