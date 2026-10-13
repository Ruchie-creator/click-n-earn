<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        @media only screen and (max-width: 620px) { .email-shell { width: 100% !important; } .email-card { border-radius: 0 !important; } .email-padding { padding: 32px 22px !important; } }
    </style>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F8FAFC;">
        <tr><td align="center" style="padding:32px 16px 40px;">
            <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
                <tr><td align="center" style="padding:0 0 22px;">
                    @include('emails.partials.header', ['logoUrl' => $logoUrl])
                </td></tr>
                <tr><td class="email-card" style="background:#FFFFFF;border:1px solid #D9E2EC;border-radius:16px;overflow:hidden;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="email-padding" style="padding:40px 44px;">
                        @include('emails.partials.greeting', ['name' => $name])
                        <h1 style="margin:0 0 14px;font-size:26px;line-height:34px;font-weight:700;color:#1F3558;">{{ $title }}</h1>
                        <p style="margin:0 0 24px;font-size:16px;line-height:25px;color:#667085;">{{ $emailMessage }}</p>
                        @if($details !== []) @include('emails.partials.detail-box', ['details' => $details]) @endif
                        @if($financial !== []) @include('emails.partials.financial-summary', ['financial' => $financial]) @endif
                        @if($ctaUrl && $ctaLabel) @include('emails.partials.cta-button', ['url' => $ctaUrl, 'label' => $ctaLabel, 'color' => $color]) @endif
                        @if($securityNote) @include('emails.partials.security-note', ['note' => $securityNote]) @endif
                    </td></tr></table>
                </td></tr>
                <tr><td align="center" style="padding:24px 14px 0;">@include('emails.partials.footer', ['supportAddress' => $supportAddress])</td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>
