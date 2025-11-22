import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useReports } from '@/hooks/useReports';
import { FileDown } from 'lucide-react';

interface ReportFilterModalProps {
  open: boolean;
  onClose: () => void;
  reportType: string;
  reportTitle: string;
}

export const ReportFilterModal = ({
  open,
  onClose,
  reportType,
  reportTitle,
}: ReportFilterModalProps) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { generateReport, loading } = useReports();

  const handleGenerate = async (format: 'csv' | 'excel' | 'pdf') => {
    const success = await generateReport(
      reportType as any,
      { startDate, endDate },
      format
    );
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{reportTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Data Inicial</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Data Final</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Escolha o formato de exportação:
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleGenerate('csv')}
                disabled={loading}
                className="flex-1"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Gerar CSV
              </Button>
              <Button
                onClick={() => handleGenerate('excel')}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Gerar Excel
              </Button>
              <Button
                onClick={() => handleGenerate('pdf')}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Gerar PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
