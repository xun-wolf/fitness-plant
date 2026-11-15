import { Card, Notice } from '../components/ui';

const UPDATED_AT = '2026-11-14';

export default function Legal({ kind }) {
  const privacy = kind === 'privacy';
  return (
    <div>
      <Card title={privacy ? '隐私政策' : '服务条款'}>
        <div className="faint">更新日期：{UPDATED_AT}</div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {privacy
            ? '这份说明告诉你，「练」会用到哪些数据、存在哪里、什么时候会离开这台设备，以及你可以怎么删掉它们。'
            : '这份说明告诉你，「练」提供什么、不提供什么，以及账号、数据和付费相关的约定。'}
        </div>
      </Card>

      {privacy ? (
        <>
          <Card title="1. 默认存在本机">
            <div className="small muted">
              档案、周框架、今日清单、训练记录、饮食记录、体重腰围和模型 Key 默认只存在这台设备的浏览器
              localStorage 里。不登录、不点「传到云端」，这些数据不会离开设备。
            </div>
          </Card>

          <Card title="2. 登录后会收集什么">
            <div className="small muted">
              使用账号密码登录时，服务器保存账号、昵称、BCrypt 密码密文、注册时间、最近登录时间和订阅状态；
              使用支付宝登录时，额外保存支付宝用户 ID。服务器不会保存密码明文。
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              只有你在「数据与备份」里主动点「传到云端」，档案、周框架、训练、饮食、体重腰围才会整份上传，
              并挂在这个账号下。
            </div>
          </Card>

          <Card title="3. 支付与第三方">
            <div className="small muted">
              支付宝负责登录授权和收款。服务器只保存商户订单号、金额、支付状态和支付宝交易号，不接触银行卡或支付密码。
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              链接大模型后，目标解读会由浏览器直接请求你自己配置的模型服务商；模型 Key 只存本机，不经过本站服务器。
              模型服务商如何处理请求，以其隐私政策为准。
            </div>
          </Card>

          <Card title="4. 存储位置与期限">
            <div className="small muted">
              本机数据保留到你清空浏览器或点「清空本机数据」；云端记录保留到你删除云端记录或注销账号；
              Redis 只保存短期登录黑名单和限流计数，按过期时间自动删除。
            </div>
          </Card>

          <Card title="5. 你的权利">
            <div className="small muted">
              你可以随时在「数据与备份」导出 JSON、删除云端记录、清空本机数据；在「账号」里注销账号会级联删除
              账号、云端记录、订阅状态和订单关联数据。注销后无法恢复。
            </div>
          </Card>

          <Notice tone="privacy">
            应用不采集身份证号、家庭住址、通讯录、精确位置，也不接入广告或第三方统计 SDK。
            如果以后新增数据用途，会在本页更新并重新征求同意。
          </Notice>
        </>
      ) : (
        <>
          <Card title="1. 服务内容">
            <div className="small muted">
              「练」提供训练计划、动作库、训练记录、饮食记录和可选的云端备份。计划和建议是通用信息，
              不是医疗诊断、康复处方或营养处方。
            </div>
          </Card>

          <Card title="2. 账号">
            <div className="small muted">
              你可以不登录使用本机功能；登录用于云端备份和多设备。账号密码由你保管，发现异常请立即修改密码。
              支付宝登录账号没有本地密码，不能使用修改密码功能。
            </div>
          </Card>

          <Card title="3. 健康与安全">
            <div className="small muted">
              训练前请确认身体状况；出现关节刺痛、麻木、头晕、胸闷等异常立即停止，必要时就医。
              应用不安排极限重量、不鼓励带伤硬练、不设计超过 24 小时的断食，也不提供补剂剂量。
            </div>
          </Card>

          <Card title="4. 付费">
            <div className="small muted">
              Pro 为一次性购买固定天数，当前不自动续费。价格、天数和收款状态以应用内展示为准；
              支付与退款按支付宝页面及你获取本应用的渠道说明处理。
            </div>
          </Card>

          <Card title="5. 数据与备份">
            <div className="small muted">
              记录默认只在本机，换设备或清理浏览器前请自行导出 JSON 或上传云端。云端上传是整份覆盖，
              上传前的云端版本会被替换。
            </div>
          </Card>

          <Card title="6. 服务变更">
            <div className="small muted">
              应用可能更新功能、调整接口或暂停服务。涉及数据用途的变化会在隐私政策页说明；
              继续使用即表示接受更新后的条款。
            </div>
          </Card>

          <Notice tone="privacy">
            本页是应用内的使用说明，不替代正式法律文件。正式上线前建议由专业人士按实际运营主体和地区法规复核。
          </Notice>
        </>
      )}

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => window.history.back()}>
          返回
        </button>
      </div>
    </div>
  );
}
