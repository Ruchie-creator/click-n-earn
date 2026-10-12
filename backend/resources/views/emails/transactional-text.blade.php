Click & Earn

Hello {{ $name }},

{{ $title }}
{{ $emailMessage }}
@foreach($details as $label => $value)
{{ $label }}: {{ $value }}
@endforeach
@foreach($financial as $label => $value)
{{ $label }}: {{ $value }}
@endforeach
@if($ctaUrl)

{{ $ctaLabel }}: {{ $ctaUrl }}
@endif
@if($securityNote)

{{ $securityNote }}
@endif

This is an automated account notification related to your Click & Earn account.
@if($supportAddress)Need help? Contact {{ $supportAddress }}.@endif
© {{ now()->year }} Click & Earn
