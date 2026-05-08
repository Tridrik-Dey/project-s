public class RegexCheck {
  public static void main(String[] args) {
    String re = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";
    System.out.println("ale@mail => " + java.util.regex.Pattern.matches(re, "ale@mail"));
    System.out.println("ale@mail.com => " + java.util.regex.Pattern.matches(re, "ale@mail.com"));
  }
}
