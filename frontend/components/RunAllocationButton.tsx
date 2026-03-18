'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRunAllocation } from '@/lib/queries';

export default function RunAllocationButton() {
  const { mutate, isPending } = useRunAllocation();

  const handleRun = () => {
    const toastId = toast.loading('Running allocation algorithm...');
    mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Allocation complete`, {
          id: toastId,
          description: `${data.allocated.toLocaleString()} allocated · ${data.skipped.toLocaleString()} skipped`,
          duration: 5000,
        });
      },
      onError: () => {
        toast.error('Allocation failed', { id: toastId });
      },
    });
  };

  return (
    <Button onClick={handleRun} disabled={isPending} variant="default">
      {isPending ? 'Running...' : '▶ Run Allocation'}
    </Button>
  );
}
