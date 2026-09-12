module.exports = async function handler(req, res) {
  const peachKey = Boolean(process.env.PEACH_API_KEY);
  const peachTemplate = Boolean(process.env.PEACH_TEMPLATE_ID);
  const metaToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const metaPhone = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);

  res.status(200).json({
    ok: true,
    whatsapp: {
      peach: {
        apiKeyConfigured: peachKey,
        templateIdConfigured: peachTemplate,
        ready: peachKey && peachTemplate
      },
      meta: {
        accessTokenConfigured: metaToken,
        phoneNumberIdConfigured: metaPhone,
        ready: metaToken && metaPhone
      },
      primary: peachKey && peachTemplate ? "peach" : (metaToken && metaPhone ? "meta" : "not_configured"),
      outboundReady: (peachKey && peachTemplate) || (metaToken && metaPhone)
    }
  });
};
