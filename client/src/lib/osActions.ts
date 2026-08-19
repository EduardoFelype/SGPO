import { formatBRL, formatDate, OS_STATUS_LABEL } from "@/lib/format";

/**
 * Extraí apenas os dígitos de um telefone para o link wa.me.
 * Formato Brasil: (11) 90000-0000 → 5511900000000 (adiciona DDI 55 se faltar).
 */
export function digitsOnly(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // Se já tem 13 dígitos começando com 55, usar como está
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  // Se tem 11/12 dígitos (DDD + número), adicionar DDI
  if (digits.length >= 10 && digits.length <= 12) return `55${digits}`;
  // Números muito grandes ou curtos demais: usar como está
  return digits;
}

export interface OsShareData {
  number: string;
  status: string;
  customerName: string | null;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleBrand: string | null;
  vehicleYear: string | null;
  vehicleColor: string | null;
  openedAt: number;
  completedAt: number | null;
  mileage: number | null;
  totalAmount: number;
  discount: number;
  services: { description: string; quantity: number; unitPrice: number; total: number }[];
  products: { description: string; quantity: number; unitPrice: number; discount: number; total: number }[];
  diagnostics: string | null;
}

export function buildOsText(data: OsShareData): string {
  const lines: string[] = [];
  lines.push(`*ORDEM DE SERVIÇO ${data.number}*`);
  lines.push(`Status: ${OS_STATUS_LABEL[data.status] ?? data.status}`);
  lines.push(`Cliente: ${data.customerName ?? "—"}`);
  if (data.vehiclePlate) {
    lines.push(`Veículo: ${data.vehicleBrand ?? ""} ${data.vehicleModel ?? ""} — Placa ${data.vehiclePlate}`);
    const extra = [data.vehicleYear, data.vehicleColor ? `Cor: ${data.vehicleColor}` : null].filter(Boolean);
    if (extra.length) lines.push(extra.join(" · "));
  }
  lines.push(`Aberta em: ${formatDate(data.openedAt)}`);
  if (data.mileage != null) lines.push(`Quilometragem: ${data.mileage.toLocaleString("pt-BR")} km`);

  lines.push("");
  lines.push("*SERVIÇOS (MÃO DE OBRA)*");
  if (data.services.length === 0) {
    lines.push("Nenhum serviço registrado.");
  } else {
    data.services.forEach((s) =>
      lines.push(`• ${s.description} — ${s.quantity}x ${formatBRL(s.unitPrice)} = ${formatBRL(s.total)}`)
    );
  }

  lines.push("");
  lines.push("*PEÇAS APLICADAS*");
  if (data.products.length === 0) {
    lines.push("Nenhuma peça registrada.");
  } else {
    data.products.forEach((p) => {
      const disc = p.discount ? ` (desconto ${formatBRL(p.discount)})` : "";
      lines.push(`• ${p.description} — ${p.quantity}x ${formatBRL(p.unitPrice)}${disc} = ${formatBRL(p.total)}`);
    });
  }

  if (data.discount > 0) lines.push(`Desconto: -${formatBRL(data.discount)}`);
  lines.push("");
  lines.push(`*TOTAL: ${formatBRL(data.totalAmount)}*`);

  if (data.completedAt) lines.push(`\nConcluída em: ${formatDate(data.completedAt)}`);

  return lines.join("\n");
}

/**
 * Abre o WhatsApp Web/App com a mensagem da OS para o número do cliente.
 */
export function shareOsViaWhatsApp(data: OsShareData, phoneRaw: string | null): void {
  const phone = digitsOnly(phoneRaw);
  if (!phone) {
    throw new Error("O cliente não possui telefone/WhatsApp cadastrado");
  }
  const text = encodeURIComponent(buildOsText(data));
  window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
}
