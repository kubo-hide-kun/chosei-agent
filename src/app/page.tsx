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
          ログイン不要で使えます。
        </p>
        <ol className="sp-steps">
          <li className="sp-step">
            <span className="sp-step-num">1</span>
            <span>
              <strong>作成</strong>
              <span className="sp-text-sub">候補日時を AI か JSON でまとめて入稿</span>
            </span>
          </li>
          <li className="sp-step">
            <span className="sp-step-num">2</span>
            <span>
              <strong>共有</strong>
              <span className="sp-text-sub">発行された URL を参加者に送る</span>
            </span>
          </li>
          <li className="sp-step">
            <span className="sp-step-num">3</span>
            <span>
              <strong>回答</strong>
              <span className="sp-text-sub">参加者が ◯ / △ / ✕ で出欠を入力</span>
            </span>
          </li>
          <li className="sp-step">
            <span className="sp-step-num">4</span>
            <span>
              <strong>決定</strong>
              <span className="sp-text-sub">集計表の ★(最有力候補)を見て日程を確定</span>
            </span>
          </li>
        </ol>
      </section>
      <CreateEventForm />
    </>
  );
}
