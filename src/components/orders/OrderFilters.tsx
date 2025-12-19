import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, CalendarIcon, Filter } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onIncludeOrder: () => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  selectedDate: Date | undefined;
  onSelectedDateChange: (date: Date | undefined) => void;
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
  selectedYear: string;
  onSelectedYearChange: (year: string) => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  primaryColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

const months = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

export const OrderFilters = ({
  searchTerm,
  onSearchChange,
  onIncludeOrder,
  filterType,
  onFilterTypeChange,
  selectedDate,
  onSelectedDateChange,
  selectedMonth,
  onSelectedMonthChange,
  selectedYear,
  onSelectedYearChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  primaryColor,
  buttonBgColor,
  buttonTextColor,
}: OrderFiltersProps) => {
  return (
    <div className="space-y-4 p-6 border-b bg-muted/30">
      {/* First Row: Search and Include Button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do cliente..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={onIncludeOrder}
          className="gap-2 shrink-0"
          style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
        >
          <Plus className="h-4 w-4" />
          Incluir Pedido
        </Button>
      </div>

      {/* Second Row: Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtrar por:</span>
        </div>
        
        <Select value={filterType} onValueChange={onFilterTypeChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="day">Dia</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="year">Ano</SelectItem>
            <SelectItem value="period">Período</SelectItem>
          </SelectContent>
        </Select>

        {filterType === "day" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar dia"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onSelectedDateChange}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        )}

        {filterType === "month" && (
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={onSelectedMonthChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={onSelectedYearChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {filterType === "year" && (
          <Select value={selectedYear} onValueChange={onSelectedYearChange}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filterType === "period" && (
          <div className="flex gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={onStartDateChange}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="self-center text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={onEndDateChange}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
};
