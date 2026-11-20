"use client";
import Link from "next/link";
import PortalShell from "../components/PortalShell";
import { useTranslation } from "../hooks/useTranslation";
/** @module Policy placeholder page */
export default function TermsPage() {
  const { t } = useTranslation();
  return (
    <PortalShell>
      <main className="plain">
        <Link className="back" href="/">
          ← {t("Back")}
        </Link>
        <article lang="en" className="space-y-4">
          <h1>StoryPal Terms of Use</h1>
          <h2 className="pt-4 text-xl font-semibold">1. Acceptance of these terms</h2>
          <p>
            By creating a StoryPal account, ticking the agreement box, or using StoryPal in any way,
            you agree to these Terms of Use (&quot;Terms&quot;) and to the StoryPal Privacy Note. If
            you do not agree, do not create an account or use StoryPal.
          </p>
          <p>
            StoryPal (&quot;StoryPal,&quot; &quot;we,&quot; &quot;us&quot;) is a web application for
            creating short personalized social stories that an adult reads together with a child.
            &quot;You&quot; means the adult who creates and manages the account.
          </p>
          <h2 className="pt-4 text-xl font-semibold">2. Who may use StoryPal</h2>
          <p>
            You must be at least 18 years old and a parent, legal guardian, or other adult
            authorized to care for or work with the child for whom you create stories. Children do
            not create accounts. A child may use StoryPal only with an adult present who holds the
            account and supervises the session.
          </p>
          <p>
            If you use StoryPal in a professional role (teacher, therapist, clinician), you confirm
            that you have whatever permission your organization and the child&#x27;s parent or
            guardian require, and that your use stays within Section 4.
          </p>
          <h2 className="pt-4 text-xl font-semibold">3. Your account</h2>
          <p>
            You are responsible for keeping your password private and for everything that happens
            under your account. Give accurate account information and keep it current. Tell us
            promptly at the contact in Section 12 if you believe your account has been used without
            your permission.
          </p>
          <p>
            One person holds each account. Do not share your sign-in with others or transfer your
            account to anyone else.
          </p>
          <h2 className="pt-4 text-xl font-semibold">4. Personal, non-commercial license</h2>
          <p>
            We grant you a limited, revocable, non-exclusive, non-transferable license to use
            StoryPal and the stories you create with it for <strong>personal, non-commercial
            purposes only</strong>: reading with a child in your family or in your direct care.
          </p>
          <p>You may not, and may not help anyone else to:</p>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              sell, rent, license, or charge for access to StoryPal or to any story, template,
              illustration, or text produced by it;
            </li>
            <li>
              publish, distribute, or bundle StoryPal stories in a book, app, course, subscription,
              or other product, whether or not for a fee;
            </li>
            <li>
              use StoryPal, its stories, or its templates to build, train, or market a competing
              product or service, including as training data for a machine-learning model;
            </li>
            <li>
              use StoryPal in a business, clinic, school, or other organization as part of a paid or
              billable service, unless we have signed a separate written license with that
              organization;
            </li>
            <li>
              copy, scrape, reverse-engineer, or extract StoryPal&#x27;s templates, prompts, source
              code, or design, except where the law allows it regardless of this restriction;
            </li>
            <li>remove or alter any StoryPal notice, credit, or mark.</li>
          </ul>
          <p>
            If you want to use StoryPal or its stories commercially or in an organizational setting,
            contact us (Section 12). Any use outside this license needs our prior written
            permission.
          </p>
          <h2 className="pt-4 text-xl font-semibold">5. Copyright and ownership</h2>
          <p>
            <strong>StoryPal content.</strong> StoryPal&#x27;s software, story templates, page
            structure, &quot;together&quot; prompts, illustrations, design, name, and logo are owned
            by its licensors and are protected by copyright, trademark, and other laws. Nothing in
            these Terms transfers ownership of any of them to you.
          </p>
          <p>
            <strong>What you enter.</strong> You keep ownership of the words you type into StoryPal
            (a child&#x27;s nickname, an interest, a situation, your edits to a story). You grant us
            a non-exclusive, royalty-free, worldwide license to store, process, display, and
            reproduce that content so that StoryPal can create, save, and show your stories to you,
            and to use it in anonymized, aggregated form to improve StoryPal and for the research
            described in Section 9.
          </p>
          <p>
            <strong>Generated stories.</strong> Each story combines StoryPal&#x27;s templates with
            your inputs. To the extent a story contains your original text, you own that text. To
            the extent it contains StoryPal templates, prompts, structure, or illustrations, we owns
            those, and your use of the whole story stays within the personal, non-commercial license
            in Section 4. You may print or save stories for your own family use. You may not
            register a copyright in, or claim exclusive rights over, a StoryPal story as a whole.
          </p>
          <p>
            <strong>Other people&#x27;s rights.</strong> Do not enter text, names, or images that
            you do not have the right to use, including copyrighted characters, song lyrics, or
            another person&#x27;s likeness.
          </p>
          <h2 className="pt-4 text-xl font-semibold">6. Acceptable use and prohibited content</h2>
          <p>
            StoryPal is for gentle, supportive stories that help a child practice everyday moments.
            You agree to use it only for that purpose and only in ways that are lawful and
            consistent with these Terms.
          </p>
          <p>You must not use StoryPal to create, enter, store, or share content that:</p>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            <li>is sexual, or sexualizes, grooms, or endangers a child in any way;</li>
            <li>threatens, encourages, or depicts violence, self-harm, abuse, or cruelty;</li>
            <li>
              harasses, demeans, or discriminates against any person or group on the basis of race,
              ethnicity, national origin, religion, disability, gender, sexual orientation, or any
              other protected characteristic;
            </li>
            <li>
              frightens, shames, punishes, or manipulates a child, or is designed to make a child
              keep secrets from a parent or guardian;
            </li>
            <li>
              contains false claims about medical treatments, or instructs a child to take
              medication or perform any medical or physical procedure;
            </li>
            <li>
              includes personal information about any identifiable person other than the nickname
              and general details the account holder enters for their own child;
            </li>
            <li>infringes anyone&#x27;s copyright, trademark, privacy, or other rights;</li>
            <li>
              contains malware, attempts to probe or disrupt StoryPal&#x27;s systems, or uses
              automated tools to access StoryPal without our permission.
            </li>
          </ul>
          <p>
            You also agree not to misrepresent who you are or your relationship to a child, and not
            to use StoryPal for any purpose a reasonable person would see as harmful to a
            child&#x27;s wellbeing.
          </p>
          <p>
            We may review content when we receive a report or have reason to believe these Terms
            have been broken. We may remove content and suspend or close accounts under Section 10,
            and we may report suspected child endangerment to the appropriate authorities as the law
            requires or allows.
          </p>
          <h2 className="pt-4 text-xl font-semibold">7. Your responsibility for what you create</h2>
          <p>
            <strong>You are fully responsible for the stories you create, edit, save, read, or share
            using StoryPal</strong>, including the words you enter, how you adapt the story, and how
            you use it with a child.
          </p>
          <p>
            StoryPal builds stories from templates and, where enabled, from automated text
            generation. These tools can produce wording that is awkward, inaccurate, or unsuitable
            for a particular child. You agree to read every story in full before using it with a
            child, to edit or discard anything that is not right for that child, and to supervise
            the child throughout.
          </p>
          <p>
            You confirm that you have the right to enter the content you enter, that it complies
            with Section 6, and that you will not hold us responsible for the content of a story you
            chose to create or use, or for any decision you make based on it.
          </p>
          <h2 className="pt-4 text-xl font-semibold">
            8. Not medical, therapeutic, or educational advice
          </h2>
          <p>
            StoryPal is a storytelling tool. It is not a medical device, a therapy, a diagnostic
            tool, or an educational program, and it does not replace the advice of a physician,
            psychologist, behavior analyst, speech-language pathologist, teacher, or other qualified
            professional.
          </p>
          <p>
            Nothing in StoryPal is a recommendation about any child&#x27;s diagnosis, treatment,
            education, or care. If you have concerns about a child&#x27;s health, development, or
            safety, consult a qualified professional. If a child is in immediate danger, contact
            local emergency services.
          </p>
          <h2 className="pt-4 text-xl font-semibold">
            9. Children, privacy, and the information you enter
          </h2>
          <p>
            StoryPal is designed so that the adult, not the child, provides information. Enter only
            what a story needs: a nickname, a broad age range, an interest, and a short, general
            description of the moment to practice. Do not enter a child&#x27;s full name, date of
            birth, address, school, photographs, diagnoses, medical records, or any other sensitive
            or identifying detail. The optional communication-passport notes are for general cues
            (&quot;likes a high-five,&quot; &quot;needs time to answer&quot;), not clinical
            information.
          </p>
          <p>
            We collect the adult&#x27;s name and email address to run the account, and we store the
            profiles and stories you create. How we handle this information is described in the
            Privacy Note, which forms part of these Terms.
          </p>
          <p>
            <strong>Research use.</strong> We may analyze usage in anonymized, aggregated form to
            improve StoryPal. If we invite you to take part in a research study that uses your
            identifiable information or your child&#x27;s, we will ask for your separate, informed
            consent under an IRB-approved protocol; using StoryPal does not by itself enroll you or
            your child in any study.
          </p>
          <p>
            <strong>Deleting your data.</strong> You can delete a profile, a story, or your whole
            account from within StoryPal at any time. Deletion is permanent.
          </p>
          <h2 className="pt-4 text-xl font-semibold">10. Suspension and termination</h2>
          <p>You may stop using StoryPal and delete your account at any time.</p>
          <p>
            We may suspend or close your account, remove content, or restrict features, with or
            without notice, if we reasonably believe you have broken these Terms, if required by
            law, or if continuing to provide the service would create a risk to a child, or to other
            users. We may also discontinue StoryPal, or any part of it, with reasonable notice where
            practical.
          </p>
          <p>Sections 4, 5, 7, 8, 11, and 12 continue to apply after your account ends.</p>
          <h2 className="pt-4 text-xl font-semibold">
            11. Disclaimers, limitation of liability, and indemnity
          </h2>
          <p>
            <strong>As is.</strong> StoryPal is provided &quot;as is&quot; and &quot;as
            available,&quot; without warranties of any kind, express or implied, including
            warranties of merchantability, fitness for a particular purpose, accuracy, and
            non-infringement. We do not promise that StoryPal will be uninterrupted, error-free, or
            suitable for any particular child.
          </p>
          <p>
            <strong>Limitation of liability.</strong> To the fullest extent permitted by law, we are
            not liable for any indirect, incidental, special, consequential, or punitive damages, or
            for any loss of data, arising out of or related to StoryPal or these Terms, even if
            advised of the possibility. Where liability cannot be excluded, it is limited to the
            greater of USD 100 or the amount you paid for StoryPal in the twelve months before the
            claim (which, for a free service, is zero). Nothing in these Terms waives our sovereign
            immunity or any protection under Section 768.28, Florida Statutes.
          </p>
          <p>
            <strong>Indemnity.</strong> You agree to defend, indemnify, and hold harmless us from
            any claim, loss, or expense (including reasonable attorneys&#x27; fees) arising from
            content you enter or create, your use of StoryPal, or your breach of these Terms.
          </p>
          <h2 className="pt-4 text-xl font-semibold">12. Changes, governing law, and contact</h2>
          <p>
            <strong>Changes.</strong> We may update these Terms. For material changes we will show
            the updated summary the next time you sign in and ask you to agree again; the date at
            the top shows the current version. Continuing to use StoryPal after a change means you
            accept it.
          </p>
          <p>
            <strong>Governing law.</strong> These Terms are governed by the laws of the State of
            Florida, without regard to conflict-of-law rules. Any dispute that cannot be resolved
            informally will be brought in the state or federal courts located in Miami-Dade County,
            Florida, and you consent to their jurisdiction, subject to any immunity we holds.
          </p>
          <p>
            <strong>Whole agreement.</strong> These Terms and the Privacy Note are the entire
            agreement between you and StoryPal. If any part is found unenforceable, the rest remains
            in effect. Our not enforcing a provision is not a waiver of it.
          </p>
          <p>
            <strong>Contact.</strong> Questions about these Terms, requests for commercial or
            organizational licenses, and reports of content that breaks Section 6: StoryPal team,
            storypal.family@gmail.com.
          </p>
          <h2 className="pt-4 text-xl font-semibold">13. Sign-up checkbox and short summary</h2>
          <p>
            Shown on the sign-up form, above the Create account button. The checkbox is required.
          </p>
          <p>
            <strong>Checkbox label</strong>
          </p>
          <blockquote className="border-l-2 pl-4 leading-relaxed">
            I&#x27;m 18 or older and a parent, guardian, or authorized adult. I&#x27;ve read and
            agree to the StoryPal Terms of Use and Privacy Note. I understand that StoryPal is for
            personal, non-commercial use, that I won&#x27;t create harmful content, and that
            I&#x27;m responsible for the stories I make and use.
          </blockquote>
          <p>
            <strong>Short summary</strong> (shown next to the checkbox, and again on first sign-in
            after a change)
          </p>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              <strong>For families, not for sale.</strong> Stories are for reading with a child in
              your own care. No selling, publishing, or using them in a paid service.
            </li>
            <li>
              <strong>StoryPal&#x27;s templates stay ours; your words stay yours.</strong> You can
              print and keep your stories for personal use.
            </li>
            <li>
              <strong>Keep it kind and safe.</strong> No sexual, violent, hateful, frightening, or
              medical-instruction content, and nothing that identifies a child.
            </li>
            <li>
              <strong>You&#x27;re in charge.</strong> Read every story before using it, edit what
              isn&#x27;t right, and stay with the child. You&#x27;re responsible for what you
              create.
            </li>
            <li>
              <strong>Not therapy or medical advice.</strong> Talk to a professional about any
              concern for a child&#x27;s health or development.
            </li>
          </ul>
        </article>
      </main>
    </PortalShell>
  );
}
