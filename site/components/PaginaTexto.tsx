export function PaginaTexto({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-extrabold">{titulo}</h1>
      <div className="materia mt-6">{children}</div>
    </div>
  );
}
