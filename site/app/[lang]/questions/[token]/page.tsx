import { notFound } from "next/navigation";

import MatchingActionForm from "@/components/MatchingActionForm";
import { answerClarification } from "@/lib/matching/questions";
import { isLang } from "@/lib/i18n";
import { supabaseAdmin } from "@/lib/supabase";
import { createHash } from "node:crypto";

// Reads one row by a secret token. Never cached, never prerendered.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/**
 * Where a volunteer answers a coordinator's question.
 *
 * Rendering this page records nothing. The answer is written only by the POST
 * server action, exactly as invitation responses go through `matching_respond`
 * — a link prefetcher, a mail scanner or a preview bot must not be able to
 * answer on someone's behalf.
 */
export default async function QuestionPage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang, token } = await params;
  if (!isLang(lang)) notFound();
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const { data } = await supabaseAdmin()
    .from("matching_questions")
    .select("question, state, answer, expires_at")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();

  if (!data) notFound();

  const np = lang === "np";
  const expired = data.state === "open" && Date.parse(data.expires_at) < Date.now();
  const done = data.state === "answered";
  const closed = data.state === "withdrawn" || expired;

  return (
    <div className="page page--narrow">
      <h1 className="h1 h1--page">
        {np ? "एउटा छोटो प्रश्न" : "A quick question"}
      </h1>

      <p className="intro" style={{ marginBottom: 20 }}>{data.question}</p>

      {done ? (
        <p className="notice" role="status">
          {np
            ? "तपाईंको जवाफ अभिलेख भइसकेको छ। धन्यवाद।"
            : "Your answer has been recorded. Thank you."}
        </p>
      ) : closed ? (
        <p className="notice notice--warn" role="status">
          {np
            ? "यो प्रश्न अब खुला छैन। कुनै काम गर्नु पर्दैन।"
            : "This question is no longer open. There is nothing you need to do."}
        </p>
      ) : (
        <>
          <MatchingActionForm
            action={answerClarification}
            label={np ? "जवाफ पठाउनुहोस्" : "Send my answer"}
            lang={lang}
          >
            <input type="hidden" name="token" value={token} />
            <label>
              {np ? "तपाईंको जवाफ" : "Your answer"}
              <textarea name="answer" rows={5} maxLength={4000} required />
            </label>
          </MatchingActionForm>
          <p className="hint" style={{ marginTop: 14, fontSize: 13 }}>
            {np
              ? "जवाफ दिनु भनेको कुनै काम स्वीकार गर्नु होइन। यसले संयोजकलाई कुन अवसर तपाईंलाई मिल्छ भनी बुझ्न मात्र मद्दत गर्छ।"
              : "Answering is not a commitment to anything. It only helps a coordinator work out whether an opportunity suits you."}
          </p>
        </>
      )}
    </div>
  );
}
