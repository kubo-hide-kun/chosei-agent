import CreateEventForm from './CreateEventForm';

export default function HomePage() {
  return (
    <>
      <section className="sp-card">
        <h1 className="sp-heading-1">日程調整を、ぽちぽちしないで。</h1>
        <p className="sp-text-sub">
          chosei-agent は候補日時をボタン操作で 1
          件ずつ登録する代わりに、JSON でまとめて入稿したり、AI
          エージェントに自然文から候補を組み立てさせたりできる日程調整サービスです。
          作成したイベントの URL を共有すると、参加者は ◯ / △ / ✕ で出欠を回答できます。
        </p>
      </section>
      <CreateEventForm />
    </>
  );
}
