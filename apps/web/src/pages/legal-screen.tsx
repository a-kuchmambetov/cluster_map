import { useEffect } from "react";
import { Link } from "react-router";

type LegalDocument = {
  title: string;
  introduction: string;
  sections: { title: string; paragraphs: string[] }[];
};

const privacy: LegalDocument = {
  title: "Privacy Policy",
  introduction:
    "Cluster Map displays cluster seating availability and peer information to users with an approved account. This notice explains the personal information involved when you request an account, sign in, or appear on the map.",
  sections: [
    {
      title: "Responsibility and contact",
      paragraphs: [
        "Cluster Map is an independent student-operated project run by Artem Kuchmambetov, 02650 Espoo, Finland. Artem Kuchmambetov is the controller responsible for personal information processed in operating this service. In this policy, ‘we’, ‘us’, and ‘our’ refer to the operator. Hive supplies map data and its staff decide access eligibility; the service is independently operated and is not presented as an official Hive service.",
        "For privacy requests, account closure, or service questions, email a.kuchmambetov@outlook.com. Hive staff and site administrators help handle requests, while the operator remains responsible for processing within Cluster Map. Do not send passwords, authenticator secrets, or recovery codes with a request.",
      ],
    },
    {
      title: "Information collected and its sources",
      paragraphs: [
        "Account information comes from you when you register: your name, email address, and password. The service stores a password hash, account identifiers, creation and update dates, email verification status, administrator approval status, and role. Administrators review account requests and manage access.",
        "If you choose GitHub sign-in, GitHub supplies identity information such as your provider identifier, name, email address, and profile image. Authentication records may include provider access tokens, refresh tokens, scopes, and expiration dates. Email and password sign-in is also available.",
        "Session and security information includes session identifiers and tokens, expiration dates, IP addresses and browser user-agent information where available, verification records, and security settings. Enabling two-factor authentication creates authenticator and recovery-code records and verification or lockout information.",
        "Hive provides the cluster and occupancy information used by the service. It includes cluster, row, seat, occupied status, and, where available, the occupant’s Intra login, display name, and photo. This information comes from Hive rather than from the occupant’s use of this website; someone may appear in occupancy records even when they are not currently using Cluster Map.",
        "Application request logs record the request time, HTTP method and path, response status, duration, and error code where applicable. The application logger omits query strings and redacts approval tokens in paths. Hosting and network providers may also process connection and security logs.",
      ],
    },
    {
      title: "Purposes and legal grounds",
      paragraphs: [
        "We use account and authentication information to process access requests, provide the service you request, and maintain sessions. For processing necessary to provide that service or take steps at your request before providing it, we rely on performance of our agreement with you under Article 6(1)(b) GDPR.",
        "We use Hive-provided occupancy, names, logins, and photos to help Hive students and staff find available seats and identify students at the clusters. We rely on legitimate interests under Article 6(1)(f) GDPR in coordinating shared facilities and helping members identify occupants. Access control, abuse prevention, and troubleshooting serve our legitimate interests in protecting the service and its users. Processing must be necessary and balanced against individuals’ rights; visibility is restricted to approved Hive staff and students. You may object to these uses, including the display of your name or photo, by contacting us.",
        "Information may also be processed where necessary to meet an applicable legal obligation. If a separate optional use requires consent, that use requires a specific choice and consent can be withdrawn. Reading this policy or accepting service terms is not consent to unrelated processing.",
        "Required registration fields are needed to process your account request. Without them an email account cannot be created. GitHub sign-in and two-factor authentication are optional. Access approval is performed by administrators; the service does not make solely automated decisions producing legal or similarly significant effects.",
        "The service is free and intended only for Hive staff and students aged 18 or over. Minors are not eligible for an account. If you believe a minor’s information has been included, contact us so we can investigate and remove it where appropriate.",
      ],
    },
    {
      title: "Who can see information",
      paragraphs: [
        "Only authenticated, administrator-approved Hive staff and students may use the map and see available peer logins, names, and photos. Map responses do not include peer email addresses. Administrators can see account names, emails, roles, and approval information to manage access. Your own session response includes your account information.",
        "Hosting, database, and network providers may process information to operate and protect the deployment. GitHub processes information when you use its sign-in flow under its own privacy policy. When a peer photo is loaded from an external host, that host receives a browser request, including your IP address and browser information.",
        "Information may be disclosed when required by law or necessary to address abuse, protect rights, or resolve a dispute. We do not sell personal information. The application contains no advertising or analytics integration.",
      ],
    },
    {
      title: "Cookies and browser storage",
      paragraphs: [
        "Authentication uses cookies to maintain your session, complete sign-in and two-factor challenges, and remember a trusted device when you select that option. Blocking these cookies can prevent sign-in or protected features from working. Cookie validity depends on the authentication configuration; expiration does not by itself establish when a server record is deleted.",
        "Your light or dark theme preference is stored locally in your browser under ui-theme. Selecting the system theme removes the saved preference. You can clear cookies and site storage through your browser settings; clearing them may sign you out and reset preferences. The application does not set advertising or analytics cookies.",
      ],
    },
    {
      title: "Retention and deletion",
      paragraphs: [
        "We retain personal information while it is in use for the purposes described in this policy: account records while an account or access request is active, occupancy information while needed to show current cluster use, and authentication and security records while needed to operate and protect the service. We remove information when it is no longer needed. Signing out invalidates your current session but does not close your account or delete occupancy information.",
        "Our deletion policy is to completely remove your personal information from our systems on the same day you request deletion. This covers all copies under our control, including account and authentication records, Hive-provided data held in Cluster Map, and personal information in our logs, caches, and backups. Email a.kuchmambetov@outlook.com to request deletion. Hive staff and site administrators carry out the process; it is not an automatic feature triggered by signing out. If we need to verify your identity or a legal obligation prevents deletion of particular information, we will explain this and any information that must be retained.",
        "Deletion from Cluster Map removes the Hive-provided information held in our systems, not the original records held in Hive’s systems. Hive remains responsible for requests concerning its own source records. We coordinate with Hive staff where continued supply could reintroduce information that has been removed. You can contact us for help directing a source-record request to Hive.",
      ],
    },
    {
      title: "Hosting, international transfers, and security",
      paragraphs: [
        "Cluster Map’s application server is hosted by Hetzner in Finland. Cloudflare provides DNS, reverse proxy, and SSL certificate services. Website traffic passes through Cloudflare before reaching our server, so Cloudflare processes visitor IP addresses, request and connection information, and traffic content as needed to deliver and protect the service. GitHub is involved when you select GitHub sign-in; an external photo host also receives a request when your browser loads a photo.",
        "Although our application server is in Finland, Cloudflare and other external providers may process information outside the European Economic Area (EEA). Cloudflare’s published Data Processing Addendum provides for standard contractual clauses and additional safeguards for restricted transfers. Any transfer must be covered by an applicable adequacy decision or other lawful safeguards. Contact a.kuchmambetov@outlook.com for information about applicable processing locations and transfer safeguards, or to request a copy of those safeguards.",
        "The application restricts map access to approved accounts, checks access on the server, stores password hashes, and supports two-factor authentication. Security also depends on deployment configuration and administrator practices. No system can guarantee absolute security; report suspected unauthorised access to the operator promptly.",
      ],
    },
    {
      title: "Your rights",
      paragraphs: [
        "Under GDPR, you may request access to your personal information, correction, erasure, restriction of processing, and, where applicable, a portable copy. You may object to processing based on legitimate interests and withdraw consent for processing based on consent without affecting earlier lawful processing. These rights have legal conditions and exceptions. You can raise a concern about being shown on the map even if you do not have an account.",
        "Send requests to a.kuchmambetov@outlook.com. Hive staff and site administrators assist with requests. We may need proportionate information to verify your identity and must normally respond within one month; a lawful extension requires notice and reasons. Our same-day deletion policy is described above. You may complain to the Finnish Office of the Data Protection Ombudsman or another competent supervisory authority. You do not have to contact us first to complain.",
      ],
    },
    {
      title: "Changes to this notice",
      paragraphs: [
        "We will inform users of material changes by email to the address supplied at registration or their Hive school email address at student.hive.fi. Notices will explain the changes and their effective date before new processing begins where required. A change to this notice does not itself authorise a new use of your information.",
      ],
    },
  ],
};

const terms: LegalDocument = {
  title: "Terms of Service",
  introduction:
    "These terms describe permitted use of Cluster Map, a service for viewing shared cluster seating and current occupancy. They apply to the service provided by the operator, separately from any licence covering the software’s source code.",
  sections: [
    {
      title: "Operator and scope",
      paragraphs: [
        "Cluster Map is independently operated by Artem Kuchmambetov, 02650 Espoo, Finland. Contact: a.kuchmambetov@outlook.com. It is a student-operated project for Hive staff and students, not an official Hive service. The service is free of charge and available only to people aged 18 or over.",
        "These terms cover use of the map and account features. They do not grant access to premises, override campus or workplace rules, or create a seat reservation. Any separate agreement governing your relationship with the facility continues to apply.",
      ],
    },
    {
      title: "Accounts and access",
      paragraphs: [
        "You must be a current Hive staff member or student aged 18 or over. Request an account using accurate information and use only an account you are authorised to access. Hive staff decide eligibility and access rules; site administrators implement account approval. Registration does not guarantee access. GitHub sign-in remains subject to the same approval requirements.",
        "Keep passwords, authenticator secrets, recovery codes, and sessions secure. Do not share your account or leave a signed-in session on a shared device. Notify the operator promptly if you suspect compromise. You are responsible for your own use of the service, subject to applicable law; you are not automatically responsible for every unauthorised act involving your account.",
      ],
    },
    {
      title: "Permitted use and other people’s privacy",
      paragraphs: [
        "You may use the service to check cluster availability and identify occupants for legitimate shared-facility purposes. Respect other users and use only information needed for those purposes.",
        "Do not use peer information to harass, stalk, discriminate against, or build attendance or behavioural profiles of individuals. Do not scrape, bulk export, republish, or distribute personal information without proper authorisation and a lawful basis.",
        "Do not bypass approval or authentication, access another person’s account, interfere with service availability, introduce malicious code, or probe systems without authorisation. Report suspected vulnerabilities privately to the operator and avoid accessing or disclosing other users’ information.",
      ],
    },
    {
      title: "Map accuracy and availability",
      paragraphs: [
        "Occupancy is an informational snapshot and can be delayed, incomplete, or incorrect. Updates depend on the source database, network, and service availability. Check the displayed update time and any stale-data notice, and confirm availability at the facility when needed.",
        "A seat shown as free is not reserved or guaranteed to be available. The map is not an emergency, safety, attendance, or access-control system. Maintenance, outages, source changes, and security measures can interrupt service. No uninterrupted availability or particular update speed is promised.",
      ],
    },
    {
      title: "Privacy and third-party services",
      paragraphs: [
        "The Privacy Policy explains account, session, and occupancy information, who can see it, and how to exercise applicable rights. It is a notice about processing, not a blanket consent to use personal information.",
        "GitHub sign-in and externally hosted images involve third-party services with their own terms and privacy practices. Using those services does not give you permission to reuse other people’s information outside the purposes of Cluster Map.",
      ],
    },
    {
      title: "Software and content rights",
      paragraphs: [
        "The operator and relevant rights holders retain their rights in the service, branding, and content. You receive permission to use the service for its intended purpose while authorised. No ownership of someone else’s profile information or photo is transferred to you.",
        "Open-source and third-party software licences govern the components to which they apply. These terms do not restrict rights granted by those licences or by mandatory law.",
      ],
    },
    {
      title: "Suspension and ending access",
      paragraphs: [
        "Hive staff decide access eligibility and applicable facility rules. The operator and site administrators may restrict or suspend access to implement those decisions, address a breach of these terms, protect users or security, comply with law, or reflect loss of eligibility. Measures must be proportionate. Where practicable and lawful, we will explain the reason and give you an opportunity to resolve the issue; urgent security action may happen immediately.",
        "You may stop using the service at any time and ask the operator to close your account. Contact the operator to question an access decision. Ending access or signing out does not automatically delete personal information; deletion requests and any lawful retention are addressed under the Privacy Policy.",
      ],
    },
    {
      title: "Responsibility and mandatory rights",
      paragraphs: [
        "Use the map with reasonable care and verify information before relying on it. To the extent permitted by applicable law, the service is provided on an as-available basis without additional promises about accuracy, fitness for a particular purpose, or uninterrupted operation.",
        "Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including for fraud, intentional misconduct, or other liability protected by mandatory law. These terms do not waive consumer, data protection, or other statutory rights. Responsibility for loss is determined under applicable law; no automatic indemnity or mandatory arbitration requirement is imposed.",
      ],
    },
    {
      title: "Changes and disputes",
      paragraphs: [
        "We will notify users of material changes by email to the address given at registration or their Hive school email address at student.hive.fi, with reasonable advance notice where practicable and the proposed effective date. Changes do not apply retroactively. Where law requires agreement to a change, posting revised terms or continued use alone does not replace that requirement.",
        "Raise service concerns with Artem Kuchmambetov at a.kuchmambetov@outlook.com so they can be investigated. These terms are governed by Finnish law, subject to any mandatory protections that apply to you. The competent courts are determined by applicable law; you do not give up a forum or protection available under mandatory law. You remain free to contact a competent regulator or use any available statutory dispute-resolution procedure.",
      ],
    },
  ],
};

export function LegalScreen({ document }: { document: "privacy" | "terms" }) {
  const content = document === "privacy" ? privacy : terms;
  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `${content.title} | Cluster Map`;
    window.scrollTo(0, 0);
    return () => {
      window.document.title = previousTitle;
    };
  }, [content.title]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 text-primary sm:py-16">
      <Link to="/" className="text-sm underline underline-offset-4">
        Back to Cluster Map
      </Link>
      <article className="mt-8">
        <header>
          <p className="text-sm font-medium text-tertiary">Cluster Map</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.title}
          </h1>
          <p className="mt-3 text-sm text-tertiary">
            Effective <time dateTime="2026-09-25">25 September 2026</time>
          </p>
          <p className="mt-3 text-sm text-tertiary">
            Privacy and service contact:{" "}
            <a
              className="underline underline-offset-4"
              href="mailto:a.kuchmambetov@outlook.com"
            >
              a.kuchmambetov@outlook.com
            </a>
          </p>
          <p className="mt-6 leading-7 text-secondary">
            {content.introduction}
          </p>
        </header>
        <nav
          aria-label={`${content.title} contents`}
          className="my-8 rounded-xl border border-secondary p-5"
        >
          <h2 className="font-semibold">On this page</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-secondary">
            {content.sections.map((section, index) => (
              <li key={section.title}>
                <a
                  className="underline underline-offset-4"
                  href={`#section-${index + 1}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="space-y-8">
          {content.sections.map((section, index) => (
            <section
              key={section.title}
              id={`section-${index + 1}`}
              className="scroll-mt-6"
            >
              <h2 className="text-xl font-semibold">
                {index + 1}. {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-secondary">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        {document === "privacy" && (
          <p className="mt-8 text-sm leading-6 text-tertiary">
            Further information:{" "}
            <a
              className="underline"
              href="https://www.edpb.europa.eu/topics/key-gdpr-concepts/data-subject-rights_en"
            >
              European Data Protection Board: your rights
            </a>
            ,{" "}
            <a className="underline" href="https://tietosuoja.fi/en/home">
              Finnish Data Protection Ombudsman
            </a>
            ,{" "}
            <a
              className="underline"
              href="https://www.cloudflare.com/cloudflare-customer-dpa/"
            >
              Cloudflare Data Processing Addendum
            </a>
            .
          </p>
        )}
      </article>
    </main>
  );
}
