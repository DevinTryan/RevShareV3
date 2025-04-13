import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TransactionsTable from "@/components/transactions/TransactionsTable";
import AddTransactionForm from "@/components/forms/AddTransactionForm";

const TransactionsPage = () => {
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-gray-600">Manage property transactions and revenue shares</p>
        </div>
        <Button 
          className="inline-flex items-center bg-green-500 hover:bg-green-600"
          onClick={() => setIsAddTransactionDialogOpen(true)}
        >
          <i className="ri-add-circle-line mr-2"></i> New Transaction
        </Button>
      </div>

      {/* Search and filter bar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-grow max-w-md">
          <Input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <i className="ri-search-line text-gray-400"></i>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <i className="ri-filter-3-line mr-2"></i> Filter
          </Button>
          <Button variant="outline" size="sm">
            <i className="ri-sort-desc-line mr-2"></i> Sort
          </Button>
          <Button variant="outline" size="sm">
            <i className="ri-download-line mr-2"></i> Export
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <TransactionsTable />

      {/* Add Transaction Dialog */}
      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogTitle className="font-semibold text-gray-800 mb-4">Add New Transaction</DialogTitle>
          <AddTransactionForm onTransactionAdded={() => setIsAddTransactionDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TransactionsPage;
