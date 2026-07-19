const AuthorBio = ({ author }: { author: string }) => (
  <aside className="rounded-xl border border-border bg-card p-5 my-8 flex gap-4 items-start">
    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold text-lg shrink-0">
      {author.charAt(0)}
    </div>
    <div className="flex-1 text-sm">
      <p className="font-semibold text-foreground m-0">{author}, fondateur d'Asclion</p>
      <p className="text-muted-foreground mt-1 leading-relaxed m-0">
        Pharmacien de formation et passionné d'IA appliquée à l'officine, Tanguy conçoit Asclion pour aider chaque équipe à délivrer un meilleur conseil et développer son panier moyen sans effort supplémentaire.
      </p>
    </div>
  </aside>
);

export default AuthorBio;
