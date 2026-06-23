import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Trophy, RotateCcw, CheckCircle2, XCircle, Loader2, Brain, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface QuizQuestion {
  id: string;
  type: "produit_for_pathologie" | "pathologie_for_produit" | "phrase_conseil";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  answered: boolean;
  selectedIndex: number | null;
  finished: boolean;
}

const QUIZ_SIZE = 10;

const Quiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<QuizState>({
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    selectedIndex: null,
    finished: false,
  });

  const generateQuiz = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch pathologies with their top produits complémentaires
      const { data: produits } = await supabase
        .from("produits_complementaires")
        .select("id, produit, categorie, phrase_conseil, pathologie_id")
        .not("phrase_conseil", "is", null)
        .order("priorite", { ascending: false });

      const { data: pathologies } = await supabase
        .from("pathologies")
        .select("id, nom_pathologie");

      if (!produits || !pathologies || produits.length < 4) {
        toast.error("Pas assez de données pour générer un quiz");
        return;
      }

      const pathoMap = new Map(pathologies.map(p => [p.id, p.nom_pathologie]));

      // Group produits by pathologie
      const byPatho = new Map<string, typeof produits>();
      for (const p of produits) {
        const pathoName = pathoMap.get(p.pathologie_id);
        if (!pathoName) continue;
        if (!byPatho.has(pathoName)) byPatho.set(pathoName, []);
        byPatho.get(pathoName)!.push(p);
      }

      const pathoNames = Array.from(byPatho.keys()).filter(k => (byPatho.get(k)?.length || 0) >= 1);
      const allProduitNames = [...new Set(produits.map(p => p.produit))];

      const questions: QuizQuestion[] = [];
      const usedIds = new Set<string>();

      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const pickRandom = <T,>(arr: T[], exclude?: Set<string>, key?: (v: T) => string): T => {
        const filtered = exclude && key ? arr.filter(v => !exclude.has(key(v))) : arr;
        return filtered[Math.floor(Math.random() * filtered.length)];
      };

      // Generate questions
      let attempts = 0;
      while (questions.length < QUIZ_SIZE && attempts < 200) {
        attempts++;
        const qType = Math.random();

        if (qType < 0.4 && pathoNames.length >= 2) {
          // Type 1: Quel produit est recommandé pour [pathologie] ?
          const patho = pickRandom(pathoNames);
          const correctProduits = byPatho.get(patho)!;
          const correct = pickRandom(correctProduits);
          if (usedIds.has(`p1-${correct.id}`)) continue;
          usedIds.add(`p1-${correct.id}`);

          const wrongOptions = shuffle(allProduitNames.filter(n => n !== correct.produit)).slice(0, 3);
          if (wrongOptions.length < 3) continue;

          const options = shuffle([correct.produit, ...wrongOptions]);
          questions.push({
            id: `p1-${correct.id}`,
            type: "produit_for_pathologie",
            question: `Quel produit complémentaire est recommandé pour la pathologie « ${patho} » ?`,
            options,
            correctIndex: options.indexOf(correct.produit),
            explanation: correct.phrase_conseil || `${correct.produit} est recommandé pour ${patho}.`,
          });
        } else if (qType < 0.7 && pathoNames.length >= 4) {
          // Type 2: Pour quelle pathologie recommande-t-on [produit] ?
          const patho = pickRandom(pathoNames);
          const correctProduits = byPatho.get(patho)!;
          const correct = pickRandom(correctProduits);
          if (usedIds.has(`p2-${correct.id}`)) continue;
          usedIds.add(`p2-${correct.id}`);

          const wrongPathos = shuffle(pathoNames.filter(p => p !== patho)).slice(0, 3);
          if (wrongPathos.length < 3) continue;

          const options = shuffle([patho, ...wrongPathos]);
          questions.push({
            id: `p2-${correct.id}`,
            type: "pathologie_for_produit",
            question: `Pour quelle pathologie recommande-t-on « ${correct.produit} » ?`,
            options,
            correctIndex: options.indexOf(patho),
            explanation: correct.phrase_conseil || `${correct.produit} est associé à ${patho}.`,
          });
        } else {
          // Type 3: Phrase conseil – à quel produit correspond cette phrase ?
          const produitsWithPhrase = produits.filter(p => p.phrase_conseil && p.phrase_conseil.length > 30);
          if (produitsWithPhrase.length < 1) continue;
          const correct = pickRandom(produitsWithPhrase);
          if (usedIds.has(`p3-${correct.id}`)) continue;
          usedIds.add(`p3-${correct.id}`);

          const wrongOptions = shuffle(allProduitNames.filter(n => n !== correct.produit)).slice(0, 3);
          if (wrongOptions.length < 3) continue;

          const options = shuffle([correct.produit, ...wrongOptions]);
          // Truncate phrase for the question
          const phrase = correct.phrase_conseil!.length > 120
            ? correct.phrase_conseil!.substring(0, 120) + "…"
            : correct.phrase_conseil!;

          questions.push({
            id: `p3-${correct.id}`,
            type: "phrase_conseil",
            question: `À quel produit correspond ce conseil ?\n« ${phrase} »`,
            options,
            correctIndex: options.indexOf(correct.produit),
            explanation: correct.phrase_conseil!,
          });
        }
      }

      setState({
        questions: shuffle(questions).slice(0, QUIZ_SIZE),
        currentIndex: 0,
        score: 0,
        answered: false,
        selectedIndex: null,
        finished: false,
      });
    } catch (e) {
      console.error("Quiz generation error:", e);
      toast.error("Erreur lors de la génération du quiz");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    generateQuiz();
  }, [generateQuiz]);

  const handleAnswer = (index: number) => {
    if (state.answered) return;
    const isCorrect = index === state.questions[state.currentIndex].correctIndex;
    setState(prev => ({
      ...prev,
      answered: true,
      selectedIndex: index,
      score: isCorrect ? prev.score + 1 : prev.score,
    }));
  };

  const handleNext = () => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.questions.length) {
      setState(prev => ({ ...prev, finished: true }));
    } else {
      setState(prev => ({
        ...prev,
        currentIndex: nextIndex,
        answered: false,
        selectedIndex: null,
      }));
    }
  };

  const current = state.questions[state.currentIndex];
  const progress = state.questions.length > 0
    ? ((state.currentIndex + (state.answered ? 1 : 0)) / state.questions.length) * 100
    : 0;

  const getScoreMessage = () => {
    const pct = (state.score / state.questions.length) * 100;
    if (pct === 100) return { text: "Parfait ! Vous êtes un expert ! 🏆", color: "text-green-500" };
    if (pct >= 80) return { text: "Excellent ! Très bonne maîtrise 💪", color: "text-green-500" };
    if (pct >= 60) return { text: "Bien joué ! Quelques révisions recommandées 📚", color: "text-yellow-500" };
    if (pct >= 40) return { text: "Continuez à vous entraîner 💡", color: "text-orange-500" };
    return { text: "Pas d'inquiétude, la pratique fait le maître ! 🔄", color: "text-red-500" };
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "produit_for_pathologie": return <Target className="h-4 w-4" />;
      case "pathologie_for_produit": return <Brain className="h-4 w-4" />;
      case "phrase_conseil": return <Zap className="h-4 w-4" />;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "produit_for_pathologie": return "Produit → Pathologie";
      case "pathologie_for_produit": return "Pathologie → Produit";
      case "phrase_conseil": return "Phrase conseil";
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground tracking-tight flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Quiz Formation
              </h1>
              <p className="text-xs text-primary-foreground/70">Testez vos connaissances en conseil officinal</p>
            </div>
          </div>
          {!loading && !state.finished && state.questions.length > 0 && (
            <Badge variant="secondary" className="text-sm font-bold">
              {state.score}/{state.currentIndex + (state.answered ? 1 : 0)}
            </Badge>
          )}
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Génération du quiz…</p>
          </div>
        ) : state.finished ? (
          /* Score final */
          <Card className="glass-card border-primary/20">
            <CardContent className="py-10 flex flex-col items-center gap-6">
              <Trophy className="h-16 w-16 text-primary" />
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">{state.score} / {state.questions.length}</h2>
                <p className={`text-lg font-semibold ${getScoreMessage().color}`}>
                  {getScoreMessage().text}
                </p>
              </div>
              <Progress value={(state.score / state.questions.length) * 100} className="w-full max-w-xs h-3" />
              <div className="flex gap-3 pt-4">
                <Button onClick={generateQuiz} className="pharmacy-gradient border-0 gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Nouveau quiz
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Retour au dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : current ? (
          <>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Question {state.currentIndex + 1} / {state.questions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Question */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="gap-1 text-xs">
                    {getTypeIcon(current.type)}
                    {getTypeBadge(current.type)}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-relaxed whitespace-pre-line">
                  {current.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {current.options.map((option, i) => {
                  const isSelected = state.selectedIndex === i;
                  const isCorrect = i === current.correctIndex;
                  const showResult = state.answered;

                  let borderClass = "border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer";
                  if (showResult && isCorrect) {
                    borderClass = "border-green-500 bg-green-500/10";
                  } else if (showResult && isSelected && !isCorrect) {
                    borderClass = "border-red-500 bg-red-500/10";
                  } else if (showResult) {
                    borderClass = "border-border opacity-50";
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={state.answered}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${borderClass}`}
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold border-current">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm font-medium flex-1">{option}</span>
                      {showResult && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
                      {showResult && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                    </button>
                  );
                })}

                {/* Explanation */}
                {state.answered && (
                  <div className="mt-4 p-3 rounded-lg bg-secondary border border-border">
                    <p className="text-xs font-semibold text-primary mb-1">💡 Explication</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{current.explanation}</p>
                  </div>
                )}

                {/* Next button */}
                {state.answered && (
                  <Button onClick={handleNext} className="w-full mt-3 pharmacy-gradient border-0">
                    {state.currentIndex + 1 >= state.questions.length ? "Voir le résultat" : "Question suivante →"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="glass-card">
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">Aucune question disponible. Vérifiez vos données cliniques.</p>
              <Button onClick={() => navigate("/dashboard")} variant="outline" className="mt-4">
                Retour
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Quiz;
