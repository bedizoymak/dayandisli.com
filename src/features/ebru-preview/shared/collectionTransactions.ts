import { useSyncExternalStore } from "react";
import type {
  CollectionTransaction,
  NewCollectionTransaction,
} from "./collectionTypes";

let transactions: CollectionTransaction[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return transactions;
}

export function useCollectionTransactions() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function addCollectionTransaction(input: NewCollectionTransaction) {
  const transaction: CollectionTransaction = {
    ...input,
    id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: input.method === "cash" ? "received" : "pending",
    createdAt: new Date().toISOString(),
  };
  transactions = [transaction, ...transactions];
  emit();
  return transaction;
}

export function cancelCollectionTransaction(id: string) {
  transactions = transactions.map((transaction) =>
    transaction.id === id
      ? { ...transaction, status: "cancelled" }
      : transaction,
  );
  emit();
}

export function updateCollectionTransaction(
  id: string,
  input: NewCollectionTransaction,
) {
  let updated: CollectionTransaction | undefined;
  transactions = transactions.map((transaction) => {
    if (transaction.id !== id) return transaction;
    updated = {
      ...transaction,
      ...input,
      status: input.method === "cash" ? "received" : "pending",
    };
    return updated;
  });
  emit();
  return updated;
}
