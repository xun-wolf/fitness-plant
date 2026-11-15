import { Card, Notice } from '../../components/ui';

export function OfflineSettings({ go }) {
  return (
    <div>
      <Card title="装到主屏">
        <div className="small muted">
          手机浏览器打开后，选择「添加到主屏幕」。装好后像普通 App 一样从桌面进入，界面会占满屏幕。
        </div>
        <div className="kv">
          <span>iPhone / iPad</span>
          <span className="muted">Safari 分享 → 添加到主屏幕</span>
        </div>
        <div className="kv">
          <span>Android</span>
          <span className="muted">Chrome 菜单 → 安装应用 / 添加到主屏幕</span>
        </div>
      </Card>

      <Card title="断网能做什么">
        <div className="kv">
          <span>打开已缓存的页面</span>
          <span className="muted">可以</span>
        </div>
        <div className="kv">
          <span>查看本机档案与记录</span>
          <span className="muted">可以</span>
        </div>
        <div className="kv">
          <span>生成计划 / 记训练</span>
          <span className="muted">可以，数据先存本机</span>
        </div>
        <div className="kv">
          <span>调用大模型</span>
          <span className="muted">需要网络</span>
        </div>
        <div className="kv">
          <span>云端上传 / 拉回</span>
          <span className="muted">需要网络</span>
        </div>
        <div className="kv">
          <span>支付宝登录 / 支付</span>
          <span className="muted">需要网络</span>
        </div>
      </Card>

      <Notice tone="privacy">
        离线时记下的数据会先留在本机；等有网络后再去「数据与备份」点上传，云端才会更新。
      </Notice>

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => go('/settings')}>
          回设置
        </button>
      </div>
    </div>
  );
}

export function SafetySettings({ go }) {
  return (
    <div>
      <Card title="这个应用不做什么">
        <div className="kv">
          <span>不诊断疾病</span>
          <span className="muted">不能替代医生</span>
        </div>
        <div className="kv">
          <span>不替代营养师</span>
          <span className="muted">热量与宏量只是估算</span>
        </div>
        <div className="kv">
          <span>不冲极限</span>
          <span className="muted">不安排极限重量、不鼓励带伤硬练</span>
        </div>
        <div className="kv">
          <span>不断食</span>
          <span className="muted">不设计超过 24 小时的断食</span>
        </div>
        <div className="kv">
          <span>不给补剂剂量</span>
          <span className="muted">不涉及药物或运动营养处方</span>
        </div>
      </Card>

      <Card title="出现这些情况就停">
        <div className="small muted">
          关节刺痛、麻木、突然的锐痛、头晕、胸闷、异常心慌。停下来，必要时就医。
          疼痛不是进步的指标，动作变形也不是。
        </div>
      </Card>

      <Card title="热量下限">
        <div className="small muted">
          应用不会给出低于女性 1600 kcal/天、男性 2000 kcal/天 的建议。
          如果你长期吃不到这个量，先去看营养科或运动医学科，而不是继续减少。
        </div>
      </Card>

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => go('/settings')}>
          回设置
        </button>
      </div>
    </div>
  );
}
