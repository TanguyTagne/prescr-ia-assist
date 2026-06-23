import { Monitor } from "lucide-react";
import { useRegister } from "@/hooks/useRegister";

const RegisterSelector = () => {
  const { registers, selectedRegister, setSelectedRegisterId } = useRegister();

  if (registers.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Monitor className="h-3 w-3 text-primary-foreground/70" />
      <select
        value={selectedRegister?.id || ""}
        onChange={(e) => setSelectedRegisterId(e.target.value)}
        className="bg-primary-foreground/10 text-primary-foreground text-[10px] font-medium rounded px-1.5 py-0.5 border-none outline-none cursor-pointer"
      >
        {registers.map((r) => (
          <option key={r.id} value={r.id} className="text-foreground bg-background">
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RegisterSelector;
