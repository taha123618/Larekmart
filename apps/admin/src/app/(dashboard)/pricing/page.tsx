"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminPriceLists,
  createAdminPriceList,
  fetchAdminPrices,
  upsertAdminProductPrice,
  patchAdminProductPrice,
  fetchAdminPriceHistory,
  fetchAdminPriceRules,
  createAdminPriceRule,
  fetchAdminCurrencyRates,
  upsertAdminCurrencyRate,
  refreshAdminCurrencyRates,
} from "@/services/pricing.service";
import type {
  CreatePriceListInput,
  UpsertProductPriceInput,
} from "@repo/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Coins,
  DollarSign,
  Globe2,
  Percent,
  Layers,
  Search,
  RefreshCw,
  Plus,
  Loader2,
  Tag,
  History,
  Edit2,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "react-toastify";

type ActiveTab = "lists" | "prices" | "rules" | "currencies" | "history";

export default function PricingDashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("lists");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>("");
  const [selectedProductPriceId, setSelectedProductPriceId] =
    useState<string>("");

  // Sheet states
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isUpsertPriceOpen, setIsUpsertPriceOpen] = useState(false);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [isUpdateRateOpen, setIsUpdateRateOpen] = useState(false);
  const [isEditPriceOpen, setIsEditPriceOpen] = useState(false);

  // Edit price state
  const [editingPrice, setEditingPrice] = useState<{
    id: string;
    productId: string;
    basePrice: number;
    compareAtPrice?: number | null;
    currency: string;
    changeReason: string;
  } | null>(null);

  // Form states
  const [listForm, setListForm] = useState<CreatePriceListInput>({
    name: "",
    code: "",
    currency: "USD",
    type: "b2c",
    isDefault: false,
    isActive: true,
  });

  const [priceForm, setPriceForm] = useState<UpsertProductPriceInput>({
    priceListId: "",
    productId: "",
    basePrice: 0,
    currency: "USD",
    isActive: true,
  });

  const [ruleForm, setRuleForm] = useState<{
    priceListId: string;
    ruleType: "tier" | "bulk" | "customer_group";
    productId: string;
    minQuantity: number;
    discountType: "percentage" | "fixed_amount" | "override_price";
    discountValue: number;
    priority: number;
    isActive: boolean;
  }>({
    priceListId: "",
    ruleType: "tier",
    productId: "",
    minQuantity: 2,
    discountType: "percentage",
    discountValue: 10,
    priority: 1,
    isActive: true,
  });

  const [rateForm, setRateForm] = useState({
    baseCurrency: "USD",
    targetCurrency: "EUR",
    exchangeRate: 0.92,
  });

  // Queries
  const {
    data: priceLists = [],
    isLoading: isListsLoading,
    refetch: refetchLists,
  } = useQuery({
    queryKey: ["admin-price-lists"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminPriceLists(token ?? undefined);
    },
  });

  const {
    data: productPrices = [],
    isLoading: isPricesLoading,
    refetch: refetchPrices,
  } = useQuery({
    queryKey: ["admin-product-prices", selectedPriceListId],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminPrices(
        selectedPriceListId || undefined,
        token ?? undefined,
      );
    },
  });

  const {
    data: priceRules = [],
    isLoading: isRulesLoading,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ["admin-price-rules", selectedPriceListId],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminPriceRules(
        selectedPriceListId || undefined,
        token ?? undefined,
      );
    },
  });

  const {
    data: currencyRates = [],
    isLoading: isRatesLoading,
    refetch: refetchRates,
  } = useQuery({
    queryKey: ["admin-currency-rates"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminCurrencyRates(token ?? undefined);
    },
  });

  const { data: priceHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["admin-price-history", selectedProductPriceId],
    queryFn: async () => {
      if (!selectedProductPriceId) return [];
      const token = await getToken();
      return fetchAdminPriceHistory(selectedProductPriceId, token ?? undefined);
    },
    enabled: !!selectedProductPriceId,
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: async (data: CreatePriceListInput) => {
      const token = await getToken();
      return createAdminPriceList(data, token ?? undefined);
    },
    onSuccess: () => {
      toast.success("Price list created successfully");
      setIsCreateListOpen(false);
      setListForm({
        name: "",
        code: "",
        currency: "USD",
        type: "b2c",
        isDefault: false,
        isActive: true,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-price-lists"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create price list");
    },
  });

  const upsertPriceMutation = useMutation({
    mutationFn: async (data: UpsertProductPriceInput) => {
      const token = await getToken();
      return upsertAdminProductPrice(data, token ?? undefined);
    },
    onSuccess: () => {
      toast.success("Product price saved successfully");
      setIsUpsertPriceOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-product-prices"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save product price");
    },
  });

  const patchPriceMutation = useMutation({
    mutationFn: async ({
      priceId,
      basePrice,
      compareAtPrice,
      changeReason,
    }: {
      priceId: string;
      basePrice: number;
      compareAtPrice?: number | null;
      changeReason: string;
    }) => {
      const token = await getToken();
      return patchAdminProductPrice(
        priceId,
        {
          basePrice,
          compareAtPrice: compareAtPrice ?? undefined,
          changeReason,
        },
        token ?? undefined,
      );
    },
    onSuccess: () => {
      toast.success("Price updated and audit log recorded");
      setIsEditPriceOpen(false);
      setEditingPrice(null);
      queryClient.invalidateQueries({ queryKey: ["admin-product-prices"] });
      if (selectedProductPriceId) {
        queryClient.invalidateQueries({
          queryKey: ["admin-price-history", selectedProductPriceId],
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update price");
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof ruleForm) => {
      const token = await getToken();
      return createAdminPriceRule(data, token ?? undefined);
    },
    onSuccess: () => {
      toast.success("Volume tier rule created successfully");
      setIsCreateRuleOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-price-rules"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create price rule");
    },
  });

  const upsertRateMutation = useMutation({
    mutationFn: async (data: typeof rateForm) => {
      const token = await getToken();
      return upsertAdminCurrencyRate(data, token ?? undefined);
    },
    onSuccess: () => {
      toast.success("Currency exchange rate updated");
      setIsUpdateRateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-currency-rates"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update currency rate");
    },
  });

  const refreshRatesMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return refreshAdminCurrencyRates(token ?? undefined);
    },
    onSuccess: (data) => {
      toast.success(
        `Live exchange rates refreshed (${data.refreshedCount} currency pairs updated).`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-currency-rates"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to refresh currency rates");
    },
  });

  // Filtered lists
  const filteredLists = priceLists.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredPrices = productPrices.filter((p) =>
    p.productId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Authoritative Pricing & Currencies
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage B2C & B2B price lists, volume discount tiers,
                multi-currency conversion, and audit snapshots.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchLists();
              refetchPrices();
              refetchRules();
              refetchRates();
              toast.info("Refreshed pricing data");
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Engine
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Price Lists
            </CardTitle>
            <Layers className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {priceLists.length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {priceLists.filter((l) => l.isDefault).length} Default Active List
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Priced Products
            </CardTitle>
            <Tag className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {productPrices.length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              In active catalog price lists
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Tier & Bulk Rules
            </CardTitle>
            <Percent className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {priceRules.length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Volume-based discount rules
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Supported Currencies
            </CardTitle>
            <Globe2 className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {currencyRates.length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Zero-drift Decimal.js conversion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <Button
            variant={activeTab === "lists" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("lists")}
            className="gap-2"
          >
            <Layers className="w-4 h-4" />
            Price Lists
          </Button>

          <Button
            variant={activeTab === "prices" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("prices")}
            className="gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Product Prices
          </Button>

          <Button
            variant={activeTab === "rules" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("rules")}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Volume & Tier Rules
          </Button>

          <Button
            variant={activeTab === "currencies" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("currencies")}
            className="gap-2"
          >
            <Globe2 className="w-4 h-4" />
            Exchange Rates
          </Button>

          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            Price Audit Trail
          </Button>
        </div>

        {/* Global Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search pricing records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* TAB 1: PRICE LISTS */}
      {activeTab === "lists" && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Catalog Price Lists</CardTitle>
              <CardDescription>
                B2C retail standards, B2B partner lists, and currency bindings.
              </CardDescription>
            </div>
            <Sheet open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Price List
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Create Price List</SheetTitle>
                  <SheetDescription>
                    Configure a new retail or wholesale price catalog.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">List Name</label>
                    <Input
                      placeholder="e.g. Summer VIP Retail"
                      value={listForm.name}
                      onChange={(e) =>
                        setListForm({ ...listForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Code (Identifier)
                    </label>
                    <Input
                      placeholder="e.g. VIP_SUMMER_2026"
                      value={listForm.code}
                      onChange={(e) =>
                        setListForm({
                          ...listForm,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Currency</label>
                    <Input
                      placeholder="USD"
                      value={listForm.currency}
                      onChange={(e) =>
                        setListForm({
                          ...listForm,
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Channel Type</label>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={listForm.type}
                      onChange={(e) =>
                        setListForm({
                          ...listForm,
                          type: e.target.value as "b2c" | "b2b",
                        })
                      }
                    >
                      <option value="b2c">B2C Retail</option>
                      <option value="b2b">B2B Wholesale</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={listForm.isDefault}
                      onChange={(e) =>
                        setListForm({
                          ...listForm,
                          isDefault: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor="isDefault"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Set as Default System Price List
                    </label>
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={
                      createListMutation.isPending ||
                      !listForm.name ||
                      !listForm.code
                    }
                    onClick={() => createListMutation.mutate(listForm)}
                  >
                    {createListMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create Price List"
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent>
            {isListsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : filteredLists.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                No price lists found. Create your first price list above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Base Currency</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLists.map((list) => (
                    <TableRow key={list.id}>
                      <TableCell className="font-mono font-medium">
                        {list.code}
                      </TableCell>
                      <TableCell>{list.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {list.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {list.currency}
                      </TableCell>
                      <TableCell>
                        {list.isDefault ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Default
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={list.isActive ? "default" : "secondary"}
                        >
                          {list.isActive ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPriceListId(list.id);
                            setActiveTab("prices");
                          }}
                        >
                          View Prices
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PRODUCT PRICES */}
      {activeTab === "prices" && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Product Base Prices</CardTitle>
              <CardDescription>
                Authoritative unit prices, compare-at original tags, and bounds.
              </CardDescription>
            </div>
            <Sheet open={isUpsertPriceOpen} onOpenChange={setIsUpsertPriceOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Product Price
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Set Product Base Price</SheetTitle>
                  <SheetDescription>
                    Configure base pricing for a product inside a price list.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Price List</label>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={priceForm.priceListId}
                      onChange={(e) =>
                        setPriceForm({
                          ...priceForm,
                          priceListId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Price List...</option>
                      {priceLists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Product ID</label>
                    <Input
                      placeholder="e.g. prod_01 or catalog ID"
                      value={priceForm.productId}
                      onChange={(e) =>
                        setPriceForm({
                          ...priceForm,
                          productId: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Base Price ($)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="49.99"
                      value={priceForm.basePrice || ""}
                      onChange={(e) =>
                        setPriceForm({
                          ...priceForm,
                          basePrice: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Compare-At Price (MSRP)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="69.99"
                      value={priceForm.compareAtPrice ?? ""}
                      onChange={(e) =>
                        setPriceForm({
                          ...priceForm,
                          compareAtPrice:
                            parseFloat(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Currency</label>
                    <Input
                      placeholder="USD"
                      value={priceForm.currency}
                      onChange={(e) =>
                        setPriceForm({
                          ...priceForm,
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={
                      upsertPriceMutation.isPending ||
                      !priceForm.priceListId ||
                      !priceForm.productId ||
                      priceForm.basePrice <= 0
                    }
                    onClick={() => upsertPriceMutation.mutate(priceForm)}
                  >
                    {upsertPriceMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save Product Price"
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent>
            {isPricesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : filteredPrices.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                No product prices found. Add base prices above to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product ID</TableHead>
                    <TableHead>Price List</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Compare-At</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrices.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell className="font-mono font-medium">
                        {price.productId}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {price.priceListName ||
                          price.priceListCode ||
                          price.priceListId}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                        ${Number(price.basePrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-slate-400 line-through text-xs">
                        {price.compareAtPrice
                          ? `$${Number(price.compareAtPrice).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {price.currency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={price.isActive ? "default" : "secondary"}
                        >
                          {price.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            setEditingPrice({
                              id: price.id,
                              productId: price.productId,
                              basePrice: Number(price.basePrice),
                              compareAtPrice: price.compareAtPrice
                                ? Number(price.compareAtPrice)
                                : null,
                              currency: price.currency,
                              changeReason: "",
                            });
                            setIsEditPriceOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Update
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            setSelectedProductPriceId(price.id);
                            setActiveTab("history");
                          }}
                        >
                          <History className="w-3.5 h-3.5" />
                          Audit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* EDIT PRICE SHEET */}
      <Sheet open={isEditPriceOpen} onOpenChange={setIsEditPriceOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Update Product Price</SheetTitle>
            <SheetDescription>
              Changes are immutably logged to the pricing audit history.
            </SheetDescription>
          </SheetHeader>
          {editingPrice && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Product ID</label>
                <Input
                  value={editingPrice.productId}
                  disabled
                  className="bg-slate-50 dark:bg-slate-900 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  New Base Price ({editingPrice.currency})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingPrice.basePrice}
                  onChange={(e) =>
                    setEditingPrice({
                      ...editingPrice,
                      basePrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Compare-At Price (Optional)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingPrice.compareAtPrice ?? ""}
                  onChange={(e) =>
                    setEditingPrice({
                      ...editingPrice,
                      compareAtPrice: parseFloat(e.target.value) || null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Audit Change Reason (Required)
                </label>
                <Input
                  placeholder="e.g. Supplier cost drop or flash sale adjustment"
                  value={editingPrice.changeReason}
                  onChange={(e) =>
                    setEditingPrice({
                      ...editingPrice,
                      changeReason: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                className="w-full mt-4"
                disabled={
                  patchPriceMutation.isPending ||
                  editingPrice.basePrice <= 0 ||
                  !editingPrice.changeReason
                }
                onClick={() =>
                  patchPriceMutation.mutate({
                    priceId: editingPrice.id,
                    basePrice: editingPrice.basePrice,
                    compareAtPrice: editingPrice.compareAtPrice,
                    changeReason: editingPrice.changeReason,
                  })
                }
              >
                {patchPriceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Commit Price Change"
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* TAB 3: VOLUME & TIER RULES */}
      {activeTab === "rules" && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Volume Tiers & Bulk Discount Rules</CardTitle>
              <CardDescription>
                Tier-based pricing rules applied dynamically during quote
                calculation.
              </CardDescription>
            </div>
            <Sheet open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Volume Rule
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Configure Volume Tier Rule</SheetTitle>
                  <SheetDescription>
                    Define threshold discounts (e.g. buy 5+ get 15% off).
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Price List</label>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={ruleForm.priceListId}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          priceListId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Price List...</option>
                      {priceLists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Product ID (Leave blank for global rule)
                    </label>
                    <Input
                      placeholder="e.g. prod_01 or blank"
                      value={ruleForm.productId}
                      onChange={(e) =>
                        setRuleForm({ ...ruleForm, productId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Minimum Quantity
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={ruleForm.minQuantity}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          minQuantity: parseInt(e.target.value, 10) || 1,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Discount Type</label>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={ruleForm.discountType}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          discountType: e.target.value as
                            | "percentage"
                            | "fixed_amount"
                            | "override_price",
                        })
                      }
                    >
                      <option value="percentage">Percentage Off (%)</option>
                      <option value="fixed_amount">Fixed Amount Off ($)</option>
                      <option value="override_price">Price Override ($)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Discount Value
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="10"
                      value={ruleForm.discountValue}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          discountValue: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={
                      createRuleMutation.isPending ||
                      !ruleForm.priceListId ||
                      ruleForm.discountValue <= 0
                    }
                    onClick={() => createRuleMutation.mutate(ruleForm)}
                  >
                    {createRuleMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create Volume Rule"
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent>
            {isRulesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : priceRules.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                No volume rules configured. Set up bulk tier discounts above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Scope</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Min Quantity</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-xs">
                        {rule.productId
                          ? `Product: ${rule.productId}`
                          : "Global (All Products)"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {rule.ruleType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {rule.minQuantity}+ units
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {rule.discountType === "percentage"
                          ? `${rule.discountValue}% OFF`
                          : `$${rule.discountValue} OFF`}
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.isActive ? "default" : "secondary"}
                        >
                          {rule.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: EXCHANGE RATES */}
      {activeTab === "currencies" && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Currency Exchange Rates</CardTitle>
              <CardDescription>
                Zero-drift high-precision exchange rate conversion table.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={refreshRatesMutation.isPending}
                onClick={() => refreshRatesMutation.mutate()}
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshRatesMutation.isPending ? "animate-spin" : ""}`}
                />
                Refresh Live FX Rates
              </Button>
              <Sheet open={isUpdateRateOpen} onOpenChange={setIsUpdateRateOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Update Exchange Rate
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Update Currency Rate</SheetTitle>
                    <SheetDescription>
                      Adjust conversion multiplier against base USD.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        Base Currency
                      </label>
                      <Input
                        value={rateForm.baseCurrency}
                        onChange={(e) =>
                          setRateForm({
                            ...rateForm,
                            baseCurrency: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        Target Currency
                      </label>
                      <Input
                        value={rateForm.targetCurrency}
                        onChange={(e) =>
                          setRateForm({
                            ...rateForm,
                            targetCurrency: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        Exchange Rate
                      </label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rateForm.exchangeRate}
                        onChange={(e) =>
                          setRateForm({
                            ...rateForm,
                            exchangeRate: parseFloat(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <Button
                      className="w-full mt-4"
                      disabled={
                        upsertRateMutation.isPending ||
                        rateForm.exchangeRate <= 0
                      }
                      onClick={() => upsertRateMutation.mutate(rateForm)}
                    >
                      {upsertRateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Currency Rate"
                      )}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            {isRatesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : currencyRates.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                No exchange rates configured.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Base</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Exchange Rate</TableHead>
                    <TableHead>Last Refreshed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencyRates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-mono font-bold">
                        {rate.baseCurrency}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {rate.targetCurrency}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {Number(rate.exchangeRate).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {rate.lastRefreshedAt
                          ? new Date(rate.lastRefreshedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rate.isActive ? "default" : "secondary"}
                        >
                          {rate.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === "history" && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Price Modification Audit Trail</CardTitle>
            <CardDescription>
              {selectedProductPriceId
                ? `Immutable snapshot of historical adjustments for Price ID: ${selectedProductPriceId}`
                : "Select a product price from the Product Prices tab to inspect historical price audit changes."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedProductPriceId ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Please select a product price from the{" "}
                <strong>Product Prices</strong> tab and click{" "}
                <strong>Audit</strong>.
              </div>
            ) : isHistoryLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : priceHistory.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                No price modifications recorded yet for this item.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Old Price</TableHead>
                    <TableHead>New Price</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.changedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono line-through text-slate-400">
                        ${Number(item.oldPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(item.newPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.currency}
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {item.changedBy}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.changeReason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
