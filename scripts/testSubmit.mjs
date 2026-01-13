// Quick local test script to POST /api/entries without the browser.
// Usage: npm run test:submit
// Requires: dev server running on http://localhost:3000

const endpoint = process.env.TEST_ENDPOINT || "http://localhost:3000/api/entries";

const payload = {
  platform: "Truth Social",
  public_handle: "realDonaldTrump",
  display_name: "Donald J. Trump",
  permalink: "https://truthsocial.com/@realDonaldTrump/posts/115855701696773990",
  tags: ["misinformation", "fascism", "encouraging violence"],
  note: "In response to the murder of Renee Good by ICE Agent J. Ross, President Trump wrote: \"I have just viewed the clip of the event which took place in Minneapolis, Minnesota. It is a horrible thing to watch. The woman screaming was, obviously, a professional agitator, and the woman driving the car was very disorderly, obstructing and resisting, who then violently, willfully, and viciously ran over the ICE Officer, who seems to have shot her in self defense. Based on the attached clip, it is hard to believe he is alive, but is now recovering in the hospital. The situation is being studied, in its entirety, but the reason these incidents are happening is because the Radical Left is threatening, assaulting, and targeting our Law Enforcement Officers and ICE Agents on a daily basis. They are just trying to do the job of MAKING AMERICA SAFE. We need to stand by and protect our Law Enforcement Officers from this Radical Left Movement of Violence and Hate! PRESIDENT DONALD J. TRUMP \"",
};

async function main() {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log("status:", res.status);
  console.log("response:", json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

