export default function AdminSectionPage({title, description}: {title: string; description: string}) {
  return <main className="admin-page"><section className="panel"><h1>{title}</h1><p>{description}</p></section></main>;
}
