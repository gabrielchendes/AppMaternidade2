export default function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    runtime: "vercel",
    time: new Date().toISOString()
  });
}
