import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("start, reserve, spend, transfer, import, simulate and reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "¿Primera vez? Crea tu cuenta" })
    .click();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Persona de prueba");
  await page
    .getByLabel("Correo electrónico")
    .fill(randomUUID() + "@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("only-a-test-password");
  await page.getByRole("button", { name: "Crear mi espacio" }).click();
  await expect(
    page.getByRole("button", { name: "Mi primera cuenta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mi primera cuenta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Banco de ejemplo");
  await dialog.getByLabel("Saldo inicial (€)").fill("1500");
  await dialog.getByLabel("Fecha del saldo inicial").fill("2026-01-01");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Crear mis primeras partidas" })
    .click();
  await expect(page.locator(".node")).toHaveCount(6);
  await page.getByRole("button", { name: "Repartir dinero" }).click();
  await dialog.getByLabel("Importe (€)", { exact: true }).fill("400");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".hero-number")).toContainText("400,00");
  await page.getByRole("button", { name: "Añadir movimiento" }).click();
  await dialog.getByLabel("Concepto").fill("Compra ficticia");
  await dialog.getByLabel("Importe (€)", { exact: true }).fill("50");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".hero-number")).toContainText("350,00");
  await page.getByRole("button", { name: "Editar partida y objetivo" }).click();
  await dialog.getByLabel("Previsión mensual (€)").fill("200");
  await dialog.getByLabel("Objetivo de ahorro (€)").fill("5000");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.screenshot({
    path: `test-results/map-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page.getByRole("button", { name: "Añadir cuenta o efectivo" }).click();
  await dialog.getByLabel("Nombre", { exact: true }).fill("Cartera");
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("cash");
  await dialog.getByLabel("Fecha del saldo inicial").fill("2026-01-01");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Añadir movimiento" }).click();
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("transfer");
  await dialog.getByLabel("Concepto").fill("Sacar efectivo");
  await dialog.getByLabel("Importe (€)", { exact: true }).fill("100");
  await dialog
    .getByLabel("Cuenta de destino")
    .selectOption({ label: "Cartera" });
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Movimientos", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV" }).click();
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "demo.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "fecha_operacion;concepto;importe\n2026-01-02;Ejemplo importado;-12,50",
      ),
    });
  await dialog.getByRole("button", { name: "Revisar importación" }).click();
  await expect(dialog.locator(".import-row")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Importar seleccionados" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Ejemplo importado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mi futuro", exact: true }).click();
  await page.getByRole("button", { name: "Probar otro reparto" }).click();
  await page.locator(".future-card input").first().fill("300");
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.locator(".future-card label strong").first()).toContainText(
    "200,00",
  );
  await page.getByRole("button", { name: "Mi mapa", exact: true }).click();
  await expect(page.locator(".summary")).toContainText("1.437,50");
  await page.reload();
  await expect(page.locator(".summary")).toContainText("1.437,50");
  await expect(page.locator(".hero-number")).toContainText("350,00");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
