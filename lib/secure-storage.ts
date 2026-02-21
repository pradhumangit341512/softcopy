"use client";

export function setSecureItem<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Failed to store item:", error);
  }
}

export function getSecureItem<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch (error) {
    console.error("Failed to retrieve item:", error);
    return null;
  }
}

export function removeSecureItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to remove item:", error);
  }
}

export function clearSecureStorage(): void {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error("Failed to clear storage:", error);
  }
}
