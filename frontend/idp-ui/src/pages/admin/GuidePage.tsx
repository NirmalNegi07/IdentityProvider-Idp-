import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon } from '../../components/icons'
import { Badge, Button, Card, CopyField, Field, Input, PageHeader } from '../../components/ui'
import { setConfigured, useSetupProgress } from '../../lib/setup'
import { startTour } from '../../lib/tour'

const MOODLE_URL_KEY = 'lahi-idp.guide.moodleUrl'

function readMoodleUrl() {
  try {
    return localStorage.getItem(MOODLE_URL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function GuidePage() {
  const progress = useSetupProgress()
  const { steps, products } = progress
  const moodle = products.find((a) => /moodle/i.test(a.displayName ?? a.clientId))

  return (
    <>
      <PageHeader
        title="Getting started"
        description="How LAHI IDP works, how to connect Moodle or any other application, and what each admin action does."
        actions={<Button variant="secondary" onClick={startTour}>Take the tour</Button>}
      />

      <div className="space-y-8">
        <HowItWorks />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-base-900">Set-up checklist</h2>
              <p className="text-sm text-base-500">Steps tick themselves as you go.</p>
            </div>
            <div className="flex min-w-48 items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-base-200">
                <div className="h-full rounded-full bg-accent-600 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <span className="text-sm font-semibold tabular-nums">{progress.done} of {progress.total}</span>
            </div>
          </div>
          <ol className="divide-y divide-line/70">
            <Step n={1} done={steps.user} title="Add a user to test with"
              action={<ActionLink to="/admin/users">Open Users</ActionLink>}>
              Create a test account, for example a teacher. Every account works for every connected application. Done when there is a user besides you.
            </Step>
            <Step n={2} done={steps.app} title="Add your application in LAHI IDP"
              action={<ActionLink to="/admin/applications?add=moodle">Add Moodle</ActionLink>}>
              Register the product so the IDP knows it. The Moodle template fills in the right settings. Copy the client secret when it&apos;s shown, because it&apos;s shown only once.
            </Step>
            <Step n={3} done={steps.configure} title="Paste the details into the application"
              action={
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" id="guide-configured" className="size-4 accent-[var(--color-accent-600)]" checked={steps.configure} disabled={!steps.app}
                    onChange={(e) => setConfigured(e.target.checked)} />
                  I&apos;ve done this
                </label>
              }>
              This step happens in the application itself. For Moodle, follow <a href="#moodle" className="font-semibold text-accent-text hover:text-accent-text-hover">Moodle settings</a> below.
            </Step>
            <Step n={4} done={steps.test} title="Sign in from the application"
              action={moodle && <ActionLink to={`/admin/applications/${moodle.id}`}>Open {moodle.displayName ?? moodle.clientId}</ActionLink>}>
              On the application&apos;s login page, choose <b>Log in with LAHI IDP</b> and sign in as the test user. Done when that user appears on the application&apos;s Users tab.
            </Step>
          </ol>
        </Card>

        <ConnectAnyApp />
        <MoodleSettings clientId={moodle?.clientId} />
        <EverydayTasks />
        <Questions />
      </div>
    </>
  )
}

function HowItWorks() {
  const flow = [
    { title: 'User opens an app', text: 'For example Moodle, and chooses "Log in with LAHI IDP".' },
    { title: 'LAHI IDP checks them', text: 'The user types their email and password on the IDP only. The app never sees the password.' },
    { title: 'The app gets the details', text: 'The IDP sends the ID, name and email. The app then starts its own session.' },
  ]
  const terms = [
    ['Application', 'A product that signs users in through LAHI IDP, such as Moodle.'],
    ['User', 'One account that works in every connected application.'],
    ['Client ID and secret', 'The application\'s own username and password for talking to the IDP. Kept in the application\'s settings.'],
    ['Issuer URL', 'The address of LAHI IDP. Applications use it to find everything else.'],
    ['Redirect URL', 'The page in the application that the IDP sends users back to after sign-in. Must match exactly.'],
  ]
  return (
    <Card className="p-5">
      <h2 className="text-base font-bold text-base-900">How LAHI IDP works</h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {flow.map((f, i) => (
          <li key={f.title} className="rounded-lg border border-line bg-canvas/50 p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-accent-fg">{i + 1}</span>
              <span className="font-semibold">{f.title}</span>
            </div>
            <p className="mt-2 text-sm text-base-600">{f.text}</p>
          </li>
        ))}
      </ol>
      <dl className="mt-5 grid gap-x-6 gap-y-3 md:grid-cols-2">
        {terms.map(([term, text]) => (
          <div key={term}>
            <dt className="text-sm font-semibold text-base-900">{term}</dt>
            <dd className="text-sm text-base-600">{text}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function Step({ n, done, title, action, children }: { n: number; done: boolean; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-4 px-5 py-4">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : 'border-2 border-base-300 text-base-500'}`}>
        {done ? <CheckIcon /> : n}
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold ${done ? 'text-base-500 line-through decoration-base-300' : 'text-base-900'}`}>{title}</span>
          {done && <Badge tone="green">Done</Badge>}
        </div>
        <p className="mt-1 text-sm text-base-600">{children}</p>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </li>
  )
}

function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-base-800 shadow-[0_2px_0_0_var(--color-line)] hover:border-base-400">
      {children}
    </Link>
  )
}

function Section({ id, title, description, children }: { id?: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16">
      <h2 className="text-lg font-bold text-base-900">{title}</h2>
      {description && <p className="mt-1 max-w-3xl text-sm text-base-600">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function ConnectAnyApp() {
  const steps: { title: string; text: ReactNode }[] = [
    {
      title: 'Check the application supports it',
      text: 'It needs "OpenID Connect" or "OAuth 2" login, either built in, through a plugin, or with a library such as openid-client for Node. Find its callback (redirect) URL in its documentation.',
    },
    {
      title: 'Add it in LAHI IDP',
      text: (
        <>
          Go to <Link to="/admin/applications?add=1" className="font-semibold text-accent-text hover:text-accent-text-hover">Applications → Add application</Link> and pick the closest template (see the table below). Then set:
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li><b>Display name</b> and <b>Client ID</b>, for example <code className="text-xs">courses-portal</code></li>
            <li><b>Redirect URI</b>: exactly the callback URL from step 1</li>
            <li><b>Allowed scopes</b>: <code className="text-xs">openid profile email</code>, plus <code className="text-xs">roles</code> only if the app should receive IDP roles</li>
            <li><b>Who can sign in</b>: <i>Implicit</i> lets every LAHI IDP user in; <i>External</i> lets in only users you add on the app&apos;s Users tab</li>
          </ul>
        </>
      ),
    },
    { title: 'Copy the client ID and secret', text: 'The secret is shown once. Store it in the application\'s settings or its environment variables, never in a browser app.' },
    {
      title: 'Set up the application',
      text: 'Enter the issuer URL, client ID, secret and scopes. Match the user by sub (the permanent IDP user ID) if the app allows it, otherwise by email. Use given_name, family_name and email for the profile.',
    },
    { title: 'Test with a test user', text: 'Sign in from the application. The user should appear on the application\'s Users tab in LAHI IDP.' },
    {
      title: 'Decide the details',
      text: 'How existing users in the application are linked (usually by email on their first sign-in), and what signing out should do. Most applications keep their own session after sign-in, so check how this one behaves.',
    },
  ]
  const templates = [
    ['Moodle', 'Moodle sites, using Moodle\'s built-in OAuth 2 services', 'Confidential, client secret'],
    ['React SPA', 'An app that runs only in the browser', 'Public, PKCE, no secret'],
    ['Express web app', 'A Node.js (or other) app with its own server', 'Confidential, client secret and PKCE'],
    ['Machine to machine', 'A backend service calling an API with no user', 'Client credentials, no users'],
  ]
  return (
    <Section title="Connect a new application" description="The same steps work for Moodle and for any future LAHI product.">
      <Card>
        <ol className="divide-y divide-line/70">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 px-5 py-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-text">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base-900">{s.title}</div>
                <div className="mt-1 text-sm text-base-600">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wide text-base-500">
            <tr><th className="px-5 py-2.5">Template</th><th className="px-5 py-2.5">Use it for</th><th className="px-5 py-2.5">What it sets</th></tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {templates.map(([name, use, sets]) => (
              <tr key={name}>
                <td className="px-5 py-2.5 font-semibold">{name}</td>
                <td className="px-5 py-2.5 text-base-600">{use}</td>
                <td className="px-5 py-2.5 text-base-600">{sets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  )
}

function MoodleSettings({ clientId }: { clientId?: string }) {
  const [moodleUrl, setMoodleUrl] = useState(readMoodleUrl)
  const base = moodleUrl.trim().replace(/\/+$/, '') || 'https://your-moodle-site'
  const issuer = window.location.origin

  function changeUrl(value: string) {
    setMoodleUrl(value)
    try {
      localStorage.setItem(MOODLE_URL_KEY, value)
    } catch {
      // Not remembered; the values below still update.
    }
  }

  const moodleSteps: ReactNode[] = [
    <>In Moodle, go to <b>Site administration → Server → OAuth 2 services</b> and create a <b>Custom</b> service.</>,
    <>Fill in <b>Name</b> (for example LAHI IDP), <b>Client ID</b>, <b>Client secret</b> and <b>Service base URL</b> from the values above.</>,
    <>Keep <b>Scopes included in a login request</b> as <code className="text-xs">openid profile email</code>, and set <b>This service will be used for</b> to the login page.</>,
    <>Decide <b>Require email verification</b>. When it&apos;s on, Moodle emails users a confirmation link before linking or creating their account.</>,
    <>Save. Moodle reads the IDP&apos;s settings by itself. Check that <b>User field mappings</b> map given_name → firstname, family_name → lastname and email → email.</>,
    <>Go to <b>Site administration → Plugins → Authentication → Manage authentication</b> and enable <b>OAuth 2</b>. A <b>Log in with LAHI IDP</b> button appears on Moodle&apos;s login page.</>,
  ]

  return (
    <Section id="moodle" title="Moodle settings" description="The exact values for Moodle. Enter your Moodle address to fill them in.">
      <Card className="p-5">
        <div className="max-w-md">
          <Field label="Your Moodle address">
            <Input id="guide-moodle-url" type="url" placeholder="https://moodle.school.org" value={moodleUrl} onChange={(e) => changeUrl(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-base-900">In LAHI IDP (the Moodle application)</h3>
            <dl className="mt-2 space-y-3">
              <Value label="Redirect URI" value={`${base}/admin/oauth2callback.php`} />
              <Value label="Post-logout redirect URI" value={`${base}/`} />
            </dl>
          </div>
          <div>
            <h3 className="text-sm font-bold text-base-900">In Moodle (OAuth 2 service)</h3>
            <dl className="mt-2 space-y-3">
              <Value label="Service base URL" value={issuer} />
              <Value label="Client ID" value={clientId ?? 'moodle'} />
              <div>
                <dt className="mb-1 text-xs font-medium text-base-500">Client secret</dt>
                <dd className="text-sm text-base-600">The secret shown when you created the application. Lost it? Open the application and choose <b>New secret</b>.</dd>
              </div>
            </dl>
          </div>
        </div>

        <h3 className="mt-6 text-sm font-bold text-base-900">Steps in Moodle</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-base-700">
          {moodleSteps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </Card>
    </Section>
  )
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-base-500">{label}</dt>
      <dd><CopyField value={value} /></dd>
    </div>
  )
}

function EverydayTasks() {
  const tasks = [
    { task: 'Add a user', where: 'Users → Add user', idp: 'Creates the account with a password you set.', app: 'Moodle creates its own account on their first sign-in.' },
    { task: 'Reset a password', where: 'Users → Password', idp: 'Sets the new password and ends their LAHI IDP session.', app: 'An open Moodle session continues until it ends.' },
    { task: 'Lock a user', where: 'Users → Lock', idp: 'Blocks every new sign-in and cancels their IDP tokens.', app: 'An open Moodle session continues until it ends; they can\'t sign in again.' },
    { task: 'Remove access to one app', where: 'Applications → app → Users', idp: 'Cancels their tokens for that app only.', app: 'With "approved users only", they can\'t sign in to it again. Otherwise they can.' },
    { task: 'Create a new secret', where: 'Applications → app → New secret', idp: 'The old secret stops working straight away.', app: 'Sign-in fails until you paste the new secret into the app.' },
    { task: 'Delete a user', where: 'Users → Delete', idp: 'Removes the account for good.', app: 'Their Moodle account stays, but they can no longer sign in to it.' },
  ]
  return (
    <Section title="Everyday tasks" description="What each action does in LAHI IDP, and what it means for an application like Moodle.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((t) => (
          <Card key={t.task} className="p-4">
            <div className="font-semibold text-base-900">{t.task}</div>
            <div className="mt-0.5 text-xs text-base-500">{t.where}</div>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-accent-text">LAHI IDP</dt><dd className="text-base-700">{t.idp}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-base-500">In the app</dt><dd className="text-base-700">{t.app}</dd></div>
            </dl>
          </Card>
        ))}
      </div>
    </Section>
  )
}

function Questions() {
  const faqs = [
    {
      q: 'Why can a locked or removed user still use Moodle?',
      a: 'After sign-in, Moodle runs on its own session and doesn\'t check back with LAHI IDP. The block applies from their next sign-in. To end it at once, suspend the user in Moodle as well.',
    },
    {
      q: 'What happens to users who already have a Moodle account?',
      a: 'On their first sign-in through LAHI IDP, Moodle matches them by email and links the accounts (after a confirmation email, if "Require email verification" is on). Their courses and grades stay as they are.',
    },
    {
      q: 'Why does a user appear on an application\'s Users tab?',
      a: 'They signed in to that application through LAHI IDP at least once, or an admin added them there.',
    },
    {
      q: 'Does signing out of Moodle sign me out of LAHI IDP?',
      a: 'No. Moodle ends only its own session, so the next "Log in with LAHI IDP" is instant while the IDP session lasts (8 hours).',
    },
    {
      q: 'Are IDP roles the same as Moodle roles?',
      a: 'No. Roles here (such as Admin) are for LAHI IDP and apps that ask for them. Teacher and student roles are still managed inside Moodle.',
    },
  ]
  return (
    <Section title="Common questions">
      <Card>
        <div className="divide-y divide-line/70">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-base-900">
                {f.q}
                <span className="text-base-400 transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-sm text-base-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </Section>
  )
}
