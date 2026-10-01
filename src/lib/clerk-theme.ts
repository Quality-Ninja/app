// Clerk's sign-in and sign-up in QA Ninja's legacy look: navy and gold, uppercase gold button, 12px fields.
// auth.ts passes this to Clerk.load. Option names are Clerk UI v1 (colorForeground, colorInput, …), not the older
// colorText/colorInputBackground. Clerk applies element styles inline, which the CSP allows when Clerk is configured.
export function clerkTheme() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  const focusRing = { outline: '2px solid #f1c40f', outlineOffset: '2px' }
  return {
    appearance: {
      options: {
        logoPlacement: 'none',
        socialButtonsVariant: 'blockButton',
        elevation: 'flush',
        animations: !calm,
      },
      captcha: { theme: 'dark', size: 'flexible' },
      variables: {
        colorPrimary: '#f1c40f',
        colorPrimaryForeground: '#041324',
        colorForeground: '#fffff7',
        colorMutedForeground: '#bdc3c7',
        colorBackground: '#172a40',
        colorNeutral: '#fffff7',
        colorInput: '#0f1a27',
        colorInputForeground: '#fffff7',
        colorBorder: '#6b7d8f',
        colorRing: '#f1c40f',
        colorDanger: '#f08a7e',
        colorSuccess: '#2ecc71',
        colorShadow: '#020512',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: '0.9375rem',
        borderRadius: '0.75rem',
      },
      elements: {
        // Our glass card is the card; Clerk's own surfaces stay transparent inside it.
        cardBox: {
          width: '100%',
          background: 'transparent',
          border: 0,
          boxShadow: 'none',
        },
        card: { background: 'transparent', boxShadow: 'none' },
        footer: { background: 'transparent' },
        header: { alignItems: 'flex-start' },
        headerTitle: {
          fontSize: '1.25rem',
          fontWeight: 700,
          textAlign: 'left',
        },
        headerSubtitle: { textAlign: 'left' },
        formFieldLabel: {
          color: '#bdc3c7',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        },
        formFieldInput: {
          padding: '12px 14px',
          '&:focus': {
            borderColor: '#f1c40f',
            boxShadow: '0 0 0 1px #f1c40f, 0 0 12px rgb(241 196 15 / 0.35)',
          },
        },
        formButtonPrimary: {
          padding: '14px',
          background: 'linear-gradient(180deg, #ffc747, #f1c40f)',
          color: '#041324',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          '&:hover': {
            boxShadow: '0 10px 25px rgb(241 196 15 / 0.25)',
            ...(calm ? {} : { transform: 'translateY(-1px)' }),
          },
          '&:focus-visible': {
            outline: '2px solid #fffff7',
            outlineOffset: '2px',
          },
        },
        socialButtonsBlockButton: {
          background: 'rgb(255 255 255 / 0.06)',
          border: '1px solid #6b7d8f',
          '&:focus-visible': focusRing,
        },
        footerAction: { justifyContent: 'center' },
        footerActionLink: {
          color: '#fffff7',
          textDecoration: 'underline',
          textDecorationColor: '#f1c40f',
          textUnderlineOffset: '3px',
          '&:hover': { color: '#f1c40f' },
          '&:focus-visible': focusRing,
        },
      },
    },
    localization: {
      signIn: {
        start: {
          title: 'Log in',
          titleCombined: 'Log in',
          subtitle: 'Use an email code or Google.',
          actionText: 'Need an account?',
          actionLink: 'Sign up',
        },
      },
      signUp: {
        start: {
          title: 'Join the Clan',
          titleCombined: 'Join the Clan',
          subtitle: 'Your website and extension share one account.',
          actionText: 'Already have an account?',
          actionLink: 'Log in',
        },
      },
    },
  }
}
