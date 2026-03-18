import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';
import type { AllocationStats, OrderLocation, RunAllocationResult, ShelfDetail, ShelfSummary, SlotSearch } from './types';

export function useAllocationStats() {
  return useQuery<AllocationStats>({
    queryKey: ['allocation', 'stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AllocationStats }>('/api/allocate/stats');
      return res.data.data;
    },
  });
}

export function useRunAllocation() {
  const queryClient = useQueryClient();
  return useMutation<RunAllocationResult>({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: RunAllocationResult }>('/api/allocate/run');
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation'] });
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
    },
  });
}

export function useShelves() {
  return useQuery<ShelfSummary[]>({
    queryKey: ['shelves'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ShelfSummary[] }>('/api/shelves');
      return res.data.data;
    },
  });
}

export function useShelfDetail(shelfCode: string) {
  return useQuery<ShelfDetail>({
    queryKey: ['shelves', shelfCode],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ShelfDetail }>(`/api/shelves/${shelfCode}`);
      return res.data.data;
    },
    enabled: !!shelfCode,
  });
}

export function useSearchOrder(orderId: string) {
  return useQuery<OrderLocation>({
    queryKey: ['search', 'order', orderId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: OrderLocation }>(`/api/search/order/${orderId}`);
      return res.data.data;
    },
    enabled: false, // manual trigger
    retry: false,
  });
}

export function useSearchSlot(shelf: string, level: number, slot: number) {
  return useQuery<SlotSearch>({
    queryKey: ['search', 'slot', shelf, level, slot],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SlotSearch }>('/api/search/slot', {
        params: { shelf, level, slot },
      });
      return res.data.data;
    },
    enabled: false,
    retry: false,
  });
}
